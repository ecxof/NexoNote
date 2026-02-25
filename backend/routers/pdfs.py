import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_conn, pdf_to_obj

router = APIRouter(prefix="/api/pdfs", tags=["pdfs"])


class PdfCreate(BaseModel):
    filePath: str
    title: str
    folderId: Optional[str] = None


class PdfUpdate(BaseModel):
    title: Optional[str] = None
    folderId: Optional[str] = None


@router.get("")
def pdfs_get_all():
    with get_conn() as c:
        cur = c.execute("SELECT * FROM pdfs ORDER BY updated_at DESC")
        return [pdf_to_obj(r) for r in cur.fetchall()]


@router.get("/{pdf_id}")
def pdfs_get_by_id(pdf_id: str):
    with get_conn() as c:
        cur = c.execute("SELECT * FROM pdfs WHERE id = ?", (pdf_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="PDF not found")
        return pdf_to_obj(row)


@router.post("", status_code=201)
def pdfs_add(body: PdfCreate):
    uid = str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    title = body.title or "Untitled PDF"
    with get_conn() as c:
        c.execute(
            "INSERT INTO pdfs (id, title, file_path, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (uid, title, body.filePath, body.folderId, now, now),
        )
        cur = c.execute("SELECT * FROM pdfs WHERE id = ?", (uid,))
        return pdf_to_obj(cur.fetchone())


@router.put("/{pdf_id}")
def pdfs_update(pdf_id: str, body: PdfUpdate):
    with get_conn() as c:
        cur = c.execute("SELECT * FROM pdfs WHERE id = ?", (pdf_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="PDF not found")
        title = body.title if body.title is not None else row["title"]
        folder_id = body.folderId if body.folderId is not None else row["folder_id"]
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
        c.execute("UPDATE pdfs SET title = ?, folder_id = ?, updated_at = ? WHERE id = ?", (title, folder_id, now, pdf_id))
        cur = c.execute("SELECT * FROM pdfs WHERE id = ?", (pdf_id,))
        return pdf_to_obj(cur.fetchone())


@router.delete("/{pdf_id}")
def pdfs_remove(pdf_id: str):
    with get_conn() as c:
        c.execute("DELETE FROM pdfs WHERE id = ?", (pdf_id,))
        return {"ok": True}
