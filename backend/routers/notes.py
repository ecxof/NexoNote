import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_conn, note_to_obj, sync_note_tags

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteCreate(BaseModel):
    folderId: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folderId: Optional[str] = None
    tags: Optional[list[str]] = None


@router.get("")
def notes_get_all():
    with get_conn() as c:
        cur = c.execute("SELECT * FROM notes ORDER BY updated_at DESC")
        rows = cur.fetchall()
        return [note_to_obj(c, r) for r in rows]


@router.get("/{note_id}")
def notes_get_by_id(note_id: str):
    with get_conn() as c:
        cur = c.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        return note_to_obj(c, row)


@router.post("", status_code=201)
def notes_create(body: NoteCreate):
    uid = str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    with get_conn() as c:
        c.execute(
            "INSERT INTO notes (id, title, content, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (uid, "Untitled", "", body.folderId, now, now),
        )
        cur = c.execute("SELECT * FROM notes WHERE id = ?", (uid,))
        row = cur.fetchone()
        out = note_to_obj(c, row)
        out["tags"] = []
        return out


@router.put("/{note_id}")
def notes_update(note_id: str, body: NoteUpdate):
    with get_conn() as c:
        cur = c.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        title = body.title if body.title is not None else row["title"]
        content = body.content if body.content is not None else row["content"]
        folder_id = body.folderId if body.folderId is not None else row["folder_id"]
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
        c.execute(
            "UPDATE notes SET title = ?, content = ?, folder_id = ?, updated_at = ? WHERE id = ?",
            (title, content, folder_id, now, note_id),
        )
        if body.tags is not None:
            sync_note_tags(c, note_id, body.tags)
        c.execute("UPDATE flashcard_decks SET title = ?, updated_at = ? WHERE source_note_id = ?", (title, now, note_id))
        cur = c.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
        return note_to_obj(c, cur.fetchone())


@router.delete("/{note_id}")
def notes_delete(note_id: str):
    with get_conn() as c:
        c.execute("DELETE FROM flashcards WHERE note_id = ?", (note_id,))
        c.execute("DELETE FROM note_tags WHERE note_id = ?", (note_id,))
        c.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        return {"ok": True}
