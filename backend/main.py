"""
NexoNote Python backend – FastAPI app.
Serves the same API contract as the Electron IPC layer over HTTP.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import set_data_dir, init
from routers import notes, folders, pdfs, settings, flashcards

app = FastAPI(title="NexoNote Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1",
        "http://localhost",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)
app.include_router(folders.router)
app.include_router(pdfs.router)
app.include_router(settings.router)
app.include_router(flashcards.router)


@app.on_event("startup")
def startup():
    data_dir = os.environ.get("NEXONOTE_DATA_DIR", "")
    if data_dir:
        set_data_dir(data_dir)
    init()


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("NEXONOTE_BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port)
