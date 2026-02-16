/**
 * Sidebar list of notes with three-dot menu (rename, delete, copy, paste, move).
 */
import { Plus } from 'lucide-react';
import { NoteItemMenu } from './ItemMenu';

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

export default function NoteList({
  notes,
  currentNoteId,
  onSelectNote,
  onCreateNote,
  onRenameNote,
  onDeleteNote,
  onCopyNote,
  onPasteNote,
  onMoveNoteToFolder,
  copiedNoteId,
  folders,
}) {
  return (
    <div className="sidebar-section">
      <div className="section-header">
        <h3 className="section-title">NOTES</h3>
        <button
          type="button"
          className="icon-button"
          onClick={() => onCreateNote(null)}
          title="New note"
          aria-label="New note"
        >
          <Plus size={16} />
        </button>
      </div>
      <ul className="section-items">
        <li className="section-item">
          <button
            type="button"
            className="section-item-button note-list-item"
            onClick={() => onCreateNote(null)}
          >
            <span className="note-list-item-title">New Note</span>
          </button>
        </li>
        {notes.map((note) => (
          <li key={note.id} className="section-item sidebar-section-item">
            <div className="note-list-item-wrap">
              <button
                type="button"
                className={`section-item-button note-list-item ${currentNoteId === note.id ? 'active' : ''}`}
                onClick={() => onSelectNote(note.id)}
              >
                <span className="note-list-item-title">{note.title || 'Untitled'}</span>
                <span className="note-list-item-date">{formatDate(note.updatedAt)}</span>
              </button>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
