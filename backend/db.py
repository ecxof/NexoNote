"""
SQLite database layer for NexoNote Python backend.
Matches schema and behavior of electron/database.cjs.
"""
import os
import sqlite3
import json
import uuid
from contextlib import contextmanager
from typing import Optional, Any

# Default: same relative path as Electron userData/nexonote
DATA_DIR = os.environ.get("NEXONOTE_DATA_DIR", "")
DB_PATH = os.path.join(DATA_DIR, "nexonote.db") if DATA_DIR else ":memory:"

_conn: Optional[sqlite3.Connection] = None


def set_data_dir(path: str) -> None:
    global DB_PATH
    os.makedirs(path, exist_ok=True)
    DB_PATH = os.path.join(path, "nexonote.db")


def get_db_path() -> str:
    return DB_PATH


@contextmanager
def get_conn():
    global _conn
    if _conn is None:
        init()
    conn = _conn
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init() -> None:
    global _conn
    if DATA_DIR:
        os.makedirs(DATA_DIR, exist_ok=True)
    _conn = sqlite3.connect(DB_PATH)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode = WAL")
    _conn.execute("PRAGMA foreign_keys = ON")
    ensure_schema()


def close() -> None:
    global _conn
    if _conn:
        _conn.close()
        _conn = None


def ensure_schema() -> None:
    """Create tables if they don't exist (match database.cjs createSchema)."""
    with get_conn() as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS folders (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL DEFAULT 'New Folder',
                parent_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
                created_at  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notes (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT 'Untitled',
                content     TEXT NOT NULL DEFAULT '',
                folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tags (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS note_tags (
                note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (note_id, tag_id)
            );
            CREATE TABLE IF NOT EXISTS pdfs (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT 'Untitled PDF',
                file_path   TEXT NOT NULL,
                folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS flashcard_decks (
                id              TEXT PRIMARY KEY,
                title           TEXT NOT NULL,
                source_note_id  TEXT REFERENCES notes(id) ON DELETE SET NULL,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS flashcards (
                id                TEXT PRIMARY KEY,
                deck_id           TEXT REFERENCES flashcard_decks(id) ON DELETE CASCADE,
                note_id           TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                topic_id          TEXT,
                prompt_text       TEXT,
                back_text         TEXT,
                question_text     TEXT NOT NULL,
                answer_text       TEXT NOT NULL,
                correct_answer_bool INTEGER,
                correct_option_index INTEGER,
                explanation_text  TEXT,
                type              TEXT NOT NULL CHECK (type IN ('flip', 'mcq', 'true_false')),
                status            TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SAVED')),
                easiness_factor   REAL NOT NULL DEFAULT 2.5,
                interval_days     INTEGER NOT NULL DEFAULT 0,
                repetition_count  INTEGER NOT NULL DEFAULT 0,
                last_review_date  TEXT,
                next_review_date  TEXT,
                created_at        TEXT NOT NULL,
                updated_at        TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS flashcard_options (
                id            TEXT PRIMARY KEY,
                flashcard_id  TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
                option_text   TEXT NOT NULL,
                is_correct    INTEGER NOT NULL DEFAULT 0,
                option_order  INTEGER NOT NULL DEFAULT 0,
                created_at    TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS review_history (
                id                    TEXT PRIMARY KEY,
                flashcard_id          TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
                reviewed_at           TEXT NOT NULL,
                rating                INTEGER NOT NULL,
                previous_ef           REAL NOT NULL,
                previous_interval     INTEGER NOT NULL,
                previous_repetition   INTEGER NOT NULL,
                next_ef               REAL NOT NULL,
                next_interval         INTEGER NOT NULL,
                next_repetition       INTEGER NOT NULL,
                next_review_date      TEXT NOT NULL,
                result                TEXT,
                difficulty            TEXT,
                response_time_ms      INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_notes_folder    ON notes(folder_id);
            CREATE INDEX IF NOT EXISTS idx_pdfs_folder     ON pdfs(folder_id);
            CREATE INDEX IF NOT EXISTS idx_note_tags_note  ON note_tags(note_id);
            CREATE INDEX IF NOT EXISTS idx_note_tags_tag   ON note_tags(tag_id);
            CREATE INDEX IF NOT EXISTS idx_flashcard_decks_note ON flashcard_decks(source_note_id);
            CREATE INDEX IF NOT EXISTS idx_flashcards_note ON flashcards(note_id);
            CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id);
            CREATE INDEX IF NOT EXISTS idx_flashcards_due  ON flashcards(next_review_date, status);
            CREATE INDEX IF NOT EXISTS idx_flashcards_type ON flashcards(type, status);
            CREATE INDEX IF NOT EXISTS idx_review_history_flashcard ON review_history(flashcard_id, reviewed_at);
        """)


# ---- Helpers: get tags for a note (conn = connection) ----
def get_tags_for_note(conn, note_id: str) -> list[str]:
    cur = conn.execute(
        "SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ?",
        (note_id,),
    )
    return [r[0] for r in cur.fetchall()]


def sync_note_tags(conn, note_id: str, tags: list) -> None:
    conn.execute("DELETE FROM note_tags WHERE note_id = ?", (note_id,))
    if not tags:
        return
    for name in tags:
        if not name:
            continue
        conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (name,))
        cur = conn.execute("SELECT id FROM tags WHERE name = ?", (name,))
        row = cur.fetchone()
        if row:
            conn.execute("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)", (note_id, row[0]))


# ---- Note ----
def note_to_obj(conn, row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "folderId": row["folder_id"],
        "tags": get_tags_for_note(conn, row["id"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


# ---- Folder ----
def folder_to_obj(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "parentId": row["parent_id"],
        "createdAt": row["created_at"],
    }


# ---- PDF ----
def pdf_to_obj(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "type": "pdf",
        "title": row["title"],
        "filePath": row["file_path"],
        "folderId": row["folder_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


# ---- Settings ----
def settings_get(conn) -> dict:
    cur = conn.execute("SELECT key, value FROM settings")
    result = {}
    for key, value in cur.fetchall():
        try:
            result[key] = json.loads(value)
        except Exception:
            result[key] = value
    return result


def settings_set(conn, partial: dict) -> dict:
    for k, v in partial.items():
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, json.dumps(v)))
    return settings_get(conn)


# ---- Flashcard options and shape (conn = connection) ----
def flashcard_options_get(conn, flashcard_id: str) -> list[dict]:
    cur = conn.execute(
        "SELECT id, option_text, is_correct, option_order FROM flashcard_options WHERE flashcard_id = ? ORDER BY option_order ASC, created_at ASC",
        (flashcard_id,),
    )
    return [
        {"id": r[0], "text": r[1], "isCorrect": bool(r[2]), "order": r[3]}
        for r in cur.fetchall()
    ]


def _row_key(row, key: str, default=None):
    try:
        return row[key] if row.keys() and key in row.keys() else default
    except (KeyError, TypeError):
        return default


def flashcard_to_obj(conn, row: sqlite3.Row) -> dict:
    fid = row["id"]
    correct_index = row["correct_option_index"] if row["correct_option_index"] is not None else None
    options = flashcard_options_get(conn, fid) if row["type"] == "mcq" else []
    correct_option_text = None
    if row["type"] == "mcq" and correct_index is not None and 0 <= correct_index < len(options):
        correct_option_text = options[correct_index].get("text") or row["answer_text"]
    deck_title = _row_key(row, "deck_title") or _row_key(row, "note_title")
    return {
        "id": fid,
        "deckId": row["deck_id"],
        "deckTitle": deck_title,
        "sourceNoteId": row["note_id"],
        "noteId": row["note_id"],
        "topicId": row["topic_id"],
        "prompt": (row["prompt_text"] or row["question_text"]) or "",
        "back": (row["back_text"] or row["answer_text"]) or "",
        "questionText": (row["prompt_text"] or row["question_text"]) or "",
        "answerText": (row["back_text"] or row["answer_text"]) or "",
        "correctAnswer": bool(row["correct_answer_bool"]) if row["type"] == "true_false" and row["correct_answer_bool"] is not None else None,
        "correctOptionIndex": correct_index if row["type"] == "mcq" else None,
        "correctOptionText": correct_option_text if row["type"] == "mcq" else None,
        "explanationText": (row["explanation_text"] or "") or "",
        "type": row["type"],
        "status": row["status"],
        "easinessFactor": row["easiness_factor"],
        "intervalDays": row["interval_days"],
        "repetitionCount": row["repetition_count"],
        "lastReviewDate": row["last_review_date"],
        "nextReviewDate": row["next_review_date"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "options": options,
    }


def ensure_deck_for_note(conn, note_id: str, fallback_title: str = "Untitled Deck") -> Optional[str]:
    cur = conn.execute("SELECT id FROM flashcard_decks WHERE source_note_id = ?", (note_id,))
    row = cur.fetchone()
    if row:
        return row[0]
    now = __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    deck_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO flashcard_decks (id, title, source_note_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (deck_id, fallback_title, note_id, now, now),
    )
    return deck_id


def write_flashcard_options(conn, flashcard_id: str, options: list) -> None:
    conn.execute("DELETE FROM flashcard_options WHERE flashcard_id = ?", (flashcard_id,))
    if not options:
        return
    now = __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    for i, opt in enumerate(options):
        opt_id = str(uuid.uuid4())
        text = str(opt.get("text") or "").strip()
        is_correct = 1 if opt.get("isCorrect") else 0
        order = int(opt.get("order", i))
        conn.execute(
            "INSERT INTO flashcard_options (id, flashcard_id, option_text, is_correct, option_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (opt_id, flashcard_id, text, is_correct, order, now),
        )
