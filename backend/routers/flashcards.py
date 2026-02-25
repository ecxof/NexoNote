import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Any
from db import (
    get_conn,
    get_tags_for_note,
    flashcard_to_obj,
    flashcard_options_get,
    ensure_deck_for_note,
    write_flashcard_options,
)
from flashcard_logic import compute_sm2_state, apply_difficulty_override

router = APIRouter(prefix="/api/flashcards", tags=["flashcards"])


def _normalize_type(t: Optional[str]) -> str:
    if t in ("mcq", "flip", "true_false"):
        return t
    if t == "MCQ":
        return "mcq"
    if t in ("True / False", "True/False", "tf"):
        return "true_false"
    return "flip"


def _normalize_status(s: Optional[str]) -> str:
    return "SAVED" if s == "SAVED" else "DRAFT"


# ---- GET all (with filters) ----
@router.get("")
def flashcards_get_all(
    status: Optional[str] = None,
    type: Optional[str] = None,
    noteId: Optional[str] = None,
    topicId: Optional[str] = None,
    dueOnly: Optional[bool] = None,
    now: Optional[str] = None,
):
    with get_conn() as c:
        sql = """
            SELECT f.*, n.title AS note_title
            FROM flashcards f
            LEFT JOIN notes n ON n.id = f.note_id
        """
        params = []
        conditions = []
        if status:
            conditions.append("f.status = ?")
            params.append(_normalize_status(status))
        if type:
            conditions.append("f.type = ?")
            params.append(_normalize_type(type))
        if noteId:
            conditions.append("f.note_id = ?")
            params.append(noteId)
        if topicId:
            conditions.append("(COALESCE(NULLIF(f.topic_id, ''), f.note_id) = ?)")
            params.append(topicId)
        if dueOnly and now:
            conditions.append("f.next_review_date IS NOT NULL AND datetime(f.next_review_date) <= datetime(?)")
            params.append(now)
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY datetime(f.updated_at) DESC"
        cur = c.execute(sql, params)
        rows = cur.fetchall()
        out = []
        for r in rows:
            obj = flashcard_to_obj(c, r)
            obj["noteTitle"] = r["note_title"] if "note_title" in r.keys() else "Untitled"
            obj["deckTitle"] = obj.get("deckTitle") or obj["noteTitle"]
            obj["sourceNoteId"] = r["note_id"]
            out.append(obj)
        return out


@router.get("/library")
def flashcards_get_library():
    with get_conn() as c:
        cur = c.execute("""
            SELECT n.id AS note_id, n.title AS note_title, COUNT(f.id) AS total_cards,
                   SUM(CASE WHEN f.status = 'SAVED' AND f.next_review_date IS NOT NULL
                             AND datetime(f.next_review_date) <= datetime('now') THEN 1 ELSE 0 END) AS due_today
            FROM notes n
            JOIN flashcards f ON f.note_id = n.id
            GROUP BY n.id, n.title
            HAVING COUNT(f.id) > 0
            ORDER BY datetime(MAX(f.updated_at)) DESC
        """)
        rows = cur.fetchall()
        return [
            {
                "noteId": r["note_id"],
                "title": r["note_title"] or "Untitled",
                "tags": get_tags_for_note(c, r["note_id"]),
                "totalCards": int(r["total_cards"] or 0),
                "dueToday": int(r["due_today"] or 0),
            }
            for r in rows
        ]


@router.get("/due")
def flashcards_get_due(
    noteId: Optional[str] = None,
    topicId: Optional[str] = None,
    type: Optional[str] = None,
    now: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
):
    now = now or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    with get_conn() as c:
        conditions = [
            "f.status = 'SAVED'",
            "f.next_review_date IS NOT NULL",
            "datetime(f.next_review_date) <= datetime(?)",
        ]
        params = [now]
        if noteId:
            conditions.append("f.note_id = ?")
            params.append(noteId)
        if topicId:
            conditions.append("(COALESCE(NULLIF(f.topic_id, ''), f.note_id) = ?)")
            params.append(topicId)
        if type:
            conditions.append("f.type = ?")
            params.append(_normalize_type(type))
        params.append(limit)
        cur = c.execute(f"""
            SELECT f.*, n.title AS note_title
            FROM flashcards f
            LEFT JOIN notes n ON n.id = f.note_id
            WHERE {" AND ".join(conditions)}
            ORDER BY datetime(f.next_review_date) ASC, datetime(f.created_at) ASC
            LIMIT ?
        """, params)
        rows = cur.fetchall()
        return [
            {**flashcard_to_obj(c, r), "noteTitle": r["note_title"] or "Untitled", "deckTitle": r["note_title"] or "Untitled", "sourceNoteId": r["note_id"]}
            for r in rows
        ]


@router.get("/analytics")
def flashcards_get_analytics(
    days: int = Query(30, ge=1, le=365),
    now: Optional[str] = None,
):
    from datetime import timedelta
    now_iso = now or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    try:
        end_dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    except Exception:
        end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=max(1, days))
    start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    with get_conn() as c:
        cur = c.execute("""
            WITH topic_base AS (
                SELECT DISTINCT COALESCE(NULLIF(f.topic_id, ''), f.note_id) AS topic_key,
                       COALESCE(fd.name, n.title, 'Untitled Topic') AS topic_name
                FROM flashcards f
                LEFT JOIN notes n ON n.id = f.note_id
                LEFT JOIN folders fd ON fd.id = f.topic_id
                WHERE f.status = 'SAVED'
            ),
            review_base AS (
                SELECT COALESCE(NULLIF(f.topic_id, ''), f.note_id) AS topic_key,
                       COUNT(rh.id) AS total_reviews,
                       SUM(CASE WHEN lower(COALESCE(rh.result, '')) = 'correct' THEN 1 ELSE 0 END) AS correct_reviews
                FROM review_history rh
                JOIN flashcards f ON f.id = rh.flashcard_id
                WHERE datetime(rh.reviewed_at) >= datetime(?) AND datetime(rh.reviewed_at) <= datetime(?)
                GROUP BY topic_key
            )
            SELECT tb.topic_key, tb.topic_name, COALESCE(rb.total_reviews, 0) AS total_reviews,
                   COALESCE(rb.correct_reviews, 0) AS correct_reviews
            FROM topic_base tb
            LEFT JOIN review_base rb ON rb.topic_key = tb.topic_key
            ORDER BY tb.topic_name COLLATE NOCASE ASC
        """, (start_iso, now_iso))
        rows = cur.fetchall()
    topics = []
    for r in rows:
        total = int(r["total_reviews"] or 0)
        correct = int(r["correct_reviews"] or 0)
        pct = round((correct / total * 100), 1) if total > 0 else 0
        category = "No Data" if total == 0 else ("Mastery" if pct >= 80 else ("Review Needed" if pct >= 60 else "Critical"))
        topics.append({
            "topicId": r["topic_key"],
            "topicName": r["topic_name"] or "Untitled Topic",
            "totalReviews": total,
            "correctReviews": correct,
            "masteryPercent": pct,
            "category": category,
            "noData": total == 0,
        })
    weak = [t for t in topics if t["masteryPercent"] < 60 and t["totalReviews"] >= 3]
    weak.sort(key=lambda x: (x["masteryPercent"], -x["totalReviews"]))
    return {
        "windowDays": max(1, days),
        "startDate": start_iso,
        "endDate": now_iso,
        "topics": topics,
        "weakTopics": weak,
    }


class ReviewBody(BaseModel):
    rating: float
    reviewedAt: Optional[str] = None
    reviewMeta: Optional[dict] = None


@router.post("/{flashcard_id}/review")
def flashcards_review(flashcard_id: str, body: ReviewBody):
    review_meta = body.reviewMeta or {}
    reviewed_at = body.reviewedAt or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    with get_conn() as c:
        cur = c.execute("SELECT * FROM flashcards WHERE id = ?", (flashcard_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        current = {
            "easinessFactor": row["easiness_factor"],
            "intervalDays": row["interval_days"],
            "repetitionCount": row["repetition_count"],
        }
        sm2_base = compute_sm2_state(current, body.rating, reviewed_at)
        sm2 = apply_difficulty_override(sm2_base, reviewed_at, review_meta.get("difficulty"))
        c.execute("""
            UPDATE flashcards SET easiness_factor = ?, interval_days = ?, repetition_count = ?,
                   last_review_date = ?, next_review_date = ?, status = 'SAVED', updated_at = ?
            WHERE id = ?
        """, (sm2["nextEf"], sm2["nextInterval"], sm2["nextRepetition"], reviewed_at, sm2["nextReviewDate"], reviewed_at, flashcard_id))
        hist_id = str(uuid.uuid4())
        c.execute("""
            INSERT INTO review_history (id, flashcard_id, reviewed_at, rating, previous_ef, previous_interval, previous_repetition,
                   next_ef, next_interval, next_repetition, next_review_date, result, difficulty, response_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            hist_id, flashcard_id, reviewed_at, sm2["rating"],
            sm2["previousEf"], sm2["previousInterval"], sm2["previousRepetition"],
            sm2["nextEf"], sm2["nextInterval"], sm2["nextRepetition"], sm2["nextReviewDate"],
            review_meta.get("result"), review_meta.get("difficulty"),
            int(review_meta["responseTimeMs"]) if isinstance(review_meta.get("responseTimeMs"), (int, float)) else None,
        ))
        cur = c.execute("SELECT f.*, n.title AS note_title FROM flashcards f LEFT JOIN notes n ON n.id = f.note_id WHERE f.id = ?", (flashcard_id,))
        fc_row = cur.fetchone()
        flashcard = flashcard_to_obj(c, fc_row)
        flashcard["noteTitle"] = fc_row["note_title"] or "Untitled"
        flashcard["deckTitle"] = flashcard.get("deckTitle") or flashcard["noteTitle"]
        flashcard["sourceNoteId"] = fc_row["note_id"]
    return {"flashcard": flashcard, "scheduling": sm2}


@router.get("/{flashcard_id}")
def flashcards_get_by_id(flashcard_id: str):
    with get_conn() as c:
        cur = c.execute("SELECT f.*, n.title AS note_title FROM flashcards f LEFT JOIN notes n ON n.id = f.note_id WHERE f.id = ?", (flashcard_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        obj = flashcard_to_obj(c, row)
        obj["noteTitle"] = row["note_title"] or "Untitled"
        obj["deckTitle"] = obj.get("deckTitle") or obj["noteTitle"]
        obj["sourceNoteId"] = row["note_id"]
        return obj


class FlashcardCreate(BaseModel):
    noteId: Optional[str] = None
    sourceNoteId: Optional[str] = None
    type: Optional[str] = "flip"
    questionText: Optional[str] = None
    prompt: Optional[str] = None
    answerText: Optional[str] = None
    back: Optional[str] = None
    options: Optional[list] = None
    correctOptionIndex: Optional[int] = None
    correctAnswer: Optional[bool] = None
    status: Optional[str] = "DRAFT"
    topicId: Optional[str] = None
    explanation: Optional[str] = None
    explanationText: Optional[str] = None
    easinessFactor: Optional[float] = 2.5
    intervalDays: Optional[int] = 0
    repetitionCount: Optional[int] = 0
    lastReviewDate: Optional[str] = None
    nextReviewDate: Optional[str] = None


@router.post("", status_code=201)
def flashcards_create(body: FlashcardCreate):
    note_id = body.noteId or body.sourceNoteId
    if not note_id:
        raise HTTPException(status_code=400, detail="noteId or sourceNoteId required")
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    fc_id = str(uuid.uuid4())
    ftype = _normalize_type(body.type)
    status = _normalize_status(body.status)
    prompt = (body.prompt or body.questionText or "").strip()
    back = (body.back or body.answerText or "").strip()
    options = body.options or []
    correct_idx = body.correctOptionIndex
    if correct_idx is None and options:
        correct_idx = next((i for i, o in enumerate(options) if o.get("isCorrect")), 0)
    correct_tf = None
    if ftype == "true_false":
        if body.correctAnswer is not None:
            correct_tf = bool(body.correctAnswer)
        elif isinstance(back, str) and back.strip().lower() in ("true", "false"):
            correct_tf = back.strip().lower() == "true"
    answer_text = back
    if ftype == "mcq" and options and correct_idx is not None and 0 <= correct_idx < len(options):
        answer_text = options[correct_idx].get("text") or back
    elif ftype == "true_false":
        answer_text = "True" if correct_tf else "False" if correct_tf is False else back
    with get_conn() as c:
        deck_id = ensure_deck_for_note(c, note_id, "Untitled Deck")
        c.execute("""
            INSERT INTO flashcards (id, deck_id, note_id, topic_id, prompt_text, back_text, question_text, answer_text,
                correct_answer_bool, correct_option_index, explanation_text, type, status, easiness_factor, interval_days,
                repetition_count, last_review_date, next_review_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            fc_id, deck_id, note_id, body.topicId, prompt, back, prompt, answer_text,
            1 if correct_tf else 0 if correct_tf is not None else None,
            correct_idx if ftype == "mcq" else None,
            (body.explanation or body.explanationText or "").strip() or None,
            ftype, status, float(body.easinessFactor or 2.5), int(body.intervalDays or 0), int(body.repetitionCount or 0),
            body.lastReviewDate, body.nextReviewDate or now, now, now,
        ))
        if ftype == "mcq" and options:
            opts = [{"text": str(o.get("text", "")).strip(), "isCorrect": i == correct_idx, "order": i} for i, o in enumerate(options) if str(o.get("text", "")).strip()]
            write_flashcard_options(c, fc_id, opts)
    return flashcards_get_by_id(fc_id)


class FlashcardUpdate(BaseModel):
    type: Optional[str] = None
    questionText: Optional[str] = None
    prompt: Optional[str] = None
    answerText: Optional[str] = None
    back: Optional[str] = None
    options: Optional[list] = None
    correctOptionIndex: Optional[int] = None
    correctAnswer: Optional[bool] = None
    status: Optional[str] = None
    topicId: Optional[str] = None
    explanation: Optional[str] = None
    explanationText: Optional[str] = None
    easinessFactor: Optional[float] = None
    intervalDays: Optional[int] = None
    repetitionCount: Optional[int] = None
    lastReviewDate: Optional[str] = None
    nextReviewDate: Optional[str] = None


@router.put("/{flashcard_id}")
def flashcards_update(flashcard_id: str, body: FlashcardUpdate):
    with get_conn() as c:
        cur = c.execute("SELECT * FROM flashcards WHERE id = ?", (flashcard_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
        ftype = _normalize_type(body.type) if body.type is not None else row["type"]
        status = _normalize_status(body.status) if body.status is not None else row["status"]
        prompt = (body.prompt or body.questionText or row["prompt_text"] or row["question_text"] or "").strip()
        back = (body.back or body.answerText or row["back_text"] or row["answer_text"] or "").strip()
        options = body.options if body.options is not None else (flashcard_options_get(c, flashcard_id) if row["type"] == "mcq" else [])
        correct_idx = body.correctOptionIndex
        if correct_idx is None and options:
            correct_idx = next((i for i, o in enumerate(options) if o.get("isCorrect")), None)
        correct_tf = body.correctAnswer if ftype == "true_false" else None
        if correct_tf is None and ftype == "true_false":
            correct_tf = bool(row["correct_answer_bool"]) if row["correct_answer_bool"] is not None else None
        answer_text = back
        if ftype == "mcq" and options and correct_idx is not None and 0 <= correct_idx < len(options):
            answer_text = options[correct_idx].get("text") or back
        elif ftype == "true_false" and correct_tf is not None:
            answer_text = "True" if correct_tf else "False"
        c.execute("""
            UPDATE flashcards SET prompt_text = ?, back_text = ?, question_text = ?, answer_text = ?, explanation_text = ?,
                type = ?, status = ?, easiness_factor = ?, interval_days = ?, repetition_count = ?,
                last_review_date = ?, next_review_date = ?, topic_id = ?, correct_answer_bool = ?, correct_option_index = ?, updated_at = ?
            WHERE id = ?
        """, (
            prompt, back, prompt, answer_text,
            (body.explanation or body.explanationText or row["explanation_text"] or "").strip() or None,
            ftype, status,
            float(body.easinessFactor) if body.easinessFactor is not None else row["easiness_factor"],
            int(body.intervalDays) if body.intervalDays is not None else row["interval_days"],
            int(body.repetitionCount) if body.repetitionCount is not None else row["repetition_count"],
            body.lastReviewDate if body.lastReviewDate is not None else row["last_review_date"],
            body.nextReviewDate if body.nextReviewDate is not None else row["next_review_date"],
            body.topicId if body.topicId is not None else row["topic_id"],
            1 if correct_tf else 0 if correct_tf is not None else None,
            correct_idx if ftype == "mcq" else None,
            now, flashcard_id,
        ))
        if ftype == "mcq":
            opts = [{"text": str(o.get("text", "")).strip(), "isCorrect": i == correct_idx, "order": i} for i, o in enumerate(options) if str(o.get("text", "")).strip()]
            write_flashcard_options(c, flashcard_id, opts)
        else:
            c.execute("DELETE FROM flashcard_options WHERE flashcard_id = ?", (flashcard_id,))
    return flashcards_get_by_id(flashcard_id)


@router.delete("/{flashcard_id}")
def flashcards_delete(flashcard_id: str):
    with get_conn() as c:
        cur = c.execute("DELETE FROM flashcards WHERE id = ?", (flashcard_id,))
        return cur.rowcount > 0
