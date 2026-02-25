"""SM-2 and difficulty override for flashcard review (matches database.cjs)."""
from datetime import datetime, timedelta, timezone


def _parse_iso(s: str) -> datetime:
    if not s:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def ensure_future_iso(base_iso: str, days: int) -> str:
    dt = _parse_iso(base_iso)
    if isinstance(days, (int, float)) and days > 0:
        dt = dt + timedelta(days=int(days))
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def compute_sm2_state(current: dict, rating: float, reviewed_at_iso: str) -> dict:
    prev_ef = float(current.get("easinessFactor") or 2.5)
    prev_interval = int(current.get("intervalDays") or 0)
    prev_rep = int(current.get("repetitionCount") or 0)
    score = max(0, min(5, round(float(rating)))) if rating is not None else 0
    repetition = prev_rep
    interval = prev_interval
    if score < 3:
        repetition = 0
        interval = 1
    else:
        repetition += 1
        if repetition == 1:
            interval = 1
        elif repetition == 2:
            interval = 6
        else:
            interval = max(1, round(interval * prev_ef))
    ef = prev_ef + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02))
    if ef < 1.3:
        ef = 1.3
    ef = round(ef, 4)
    next_review = ensure_future_iso(reviewed_at_iso, interval)
    return {
        "previousEf": prev_ef,
        "previousInterval": prev_interval,
        "previousRepetition": prev_rep,
        "nextEf": ef,
        "nextInterval": interval,
        "nextRepetition": repetition,
        "nextReviewDate": next_review,
        "rating": score,
    }


def apply_difficulty_override(sm2: dict, reviewed_at_iso: str, difficulty: str) -> dict:
    level = (difficulty or "").strip().lower()
    next_sm2 = dict(sm2)
    dt = _parse_iso(reviewed_at_iso)
    if level == "again":
        next_sm2["nextReviewDate"] = reviewed_at_iso
        return next_sm2
    if level == "hard":
        dt = dt + timedelta(hours=3)
        next_sm2["nextReviewDate"] = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        return next_sm2
    if level == "good":
        dt = dt + timedelta(days=1)
        next_sm2["nextReviewDate"] = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        return next_sm2
    if level == "easy":
        dt = dt + timedelta(days=2)
        next_sm2["nextReviewDate"] = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        return next_sm2
    return next_sm2
