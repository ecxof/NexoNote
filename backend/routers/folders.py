import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_conn, folder_to_obj

router = APIRouter(prefix="/api/folders", tags=["folders"])


class FolderCreate(BaseModel):
    name: str
    parentId: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parentId: Optional[str] = None


@router.get("")
def folders_get_all():
    with get_conn() as c:
        cur = c.execute("SELECT * FROM folders ORDER BY created_at ASC")
        return [folder_to_obj(r) for r in cur.fetchall()]


@router.post("", status_code=201)
def folders_create(body: FolderCreate):
    uid = str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    name = body.name or "New Folder"
    with get_conn() as c:
        c.execute(
            "INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)",
            (uid, name, body.parentId, now),
        )
        cur = c.execute("SELECT * FROM folders WHERE id = ?", (uid,))
        return folder_to_obj(cur.fetchone())


@router.put("/{folder_id}")
def folders_update(folder_id: str, body: FolderUpdate):
    with get_conn() as c:
        cur = c.execute("SELECT * FROM folders WHERE id = ?", (folder_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Folder not found")
        name = body.name if body.name is not None else row["name"]
        parent_id = body.parentId if body.parentId is not None else row["parent_id"]
        c.execute("UPDATE folders SET name = ?, parent_id = ? WHERE id = ?", (name, parent_id, folder_id))
        cur = c.execute("SELECT * FROM folders WHERE id = ?", (folder_id,))
        return folder_to_obj(cur.fetchone())


@router.delete("/{folder_id}")
def folders_delete(folder_id: str):
    with get_conn() as c:
        cur = c.execute("SELECT * FROM folders WHERE id = ?", (folder_id,))
        row = cur.fetchone()
        if not row:
            return {"ok": False}
        parent_id = row["parent_id"]
        c.execute("UPDATE folders SET parent_id = ? WHERE parent_id = ?", (parent_id, folder_id))
        c.execute("UPDATE notes SET folder_id = NULL WHERE folder_id = ?", (folder_id,))
        c.execute("UPDATE pdfs SET folder_id = NULL WHERE folder_id = ?", (folder_id,))
        c.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
        return {"ok": True}
