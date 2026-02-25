/**
 * Home dashboard: greeting, Create New Note, Import File, flashcard hero, Recent Notes (real data).
 * Clicking a note opens the editor; three-dot menu for rename, delete, copy, paste, move.
 */
import { Plus, Upload, BookOpen, ArrowRight } from 'lucide-react';
import { NoteItemMenu } from './ItemMenu';
import { useEffect, useState } from 'react';
import { getDueFlashcards } from '../services/flashcardService';

function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

/** Strip HTML and take first ~120 chars for preview. */
function previewFromContent(html) {
  if (!html || typeof html !== 'string') return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? text.slice(0, 120) + '…' : text;
}

/** Non-interactive path string for a note's folder. folders: { id, name, parentId }[]. */
function getFolderPathString(folderId, folders) {
  if (!folderId || !folders?.length) return 'All';
  const byId = new Map((folders || []).map((f) => [f.id, f]));
  const path = [];
  let current = byId.get(folderId);
  while (current) {
    path.push(current.name);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  path.reverse();
  return path.length ? ['All', ...path].join(' / ') : 'All';
}

export default function Dashboard({
  notes,
  onCreateNote,
  onSelectNote,
  onImportPdf,
  onRenameNote,
  onDeleteNote,
  onCopyNote,
  onPasteNote,
  onMoveNoteToFolder,
  copiedNoteId,
  folders,
  refreshKey = 0,
  onStartReviewSession,
}) {
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const due = await getDueFlashcards({});
      if (mounted) setDueCount(due.length);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const recentNotes = [...(notes || [])].sort((a, b) => {
    const ta = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
    const tb = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
    return tb - ta;
  });

  return (
    <main className="main-content">
      <div className="main-content-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-greeting">Welcome back</h1>
            <p className="header-subtitle">Ready to get back to work?</p>
          </div>
          <div className="header-right">
            <button type="button" className="btn-primary" onClick={() => onCreateNote(null)}>
              <Plus size={20} />
              Create New Note
            </button>
            <button type="button" className="btn-secondary" onClick={onImportPdf}>
              <Upload size={20} />
              Import File
            </button>
          </div>
        </div>
      </div>

      <div className="hero-card">
        <div className="hero-card-left">
          <BookOpen size={48} className="hero-icon" />
          <div className="hero-content">
            <h2 className="hero-title">Review Flashcards</h2>
            <p className="hero-subtitle">You have {dueCount} cards due for review today.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-hero"
          onClick={() => onStartReviewSession?.({ dueOnly: true })}
        >
          Start Session
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="recent-notes-section">
        <div className="recent-notes-header">
          <h2 className="recent-notes-title">Recent Notes</h2>
        </div>
        <div className="recent-notes-grid">
          {recentNotes.length === 0 ? (
            <p className="header-subtitle">No notes yet. Create one to get started.</p>
          ) : (
            recentNotes.map((note) => (
              <div
                key={note.id}
                className="note-card note-card-with-menu"
              >
                <div className="note-card-menu" onClick={(e) => e.stopPropagation()}>
                  <NoteItemMenu
                    noteId={note.id}
                    noteTitle={note.title || 'Untitled'}
                    onRename={onRenameNote}
                    onDelete={onDeleteNote}
                    onCopy={onCopyNote}
                    onPaste={onPasteNote}
                    onMoveToFolder={onMoveNoteToFolder}
                    canPaste={!!copiedNoteId}
                    folders={folders}
                  />
                </div>
                <button
                  type="button"
                  className="note-card-clickable"
                  onClick={() => onSelectNote(note.id)}
                >
                  <div className="note-card-content">
                    <h3 className="note-title">{note.title || 'Untitled'}</h3>
                    <p className="note-preview">{previewFromContent(note.content)}</p>
                  </div>
                  {Array.isArray(note.tags) && note.tags.length > 0 && (
                    <div className="note-card-footer">
                      {note.tags.map((tag) => (
                        <span key={tag} className="note-tag">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="note-card-meta">
                    <span className="note-card-path">{getFolderPathString(note.folderId, folders)}</span>
                    <span className="note-card-time">{formatDate(note.updatedAt)}</span>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
