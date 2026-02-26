/**
 * Single-note view: editable title, rich text editor, Save and Delete.
 * When autoSave is on, content/title changes are debounced and saved automatically.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import RichTextEditor from './RichTextEditor';
import { updateNote } from '../services/noteService';
import { Save } from 'lucide-react';

const DEBOUNCE_MS = 1500;

/** Build breadcrumb path: [All, root, ..., folder]. folders: { id, name, parentId }[].
 * Returns { id: string | null, name: string }[] (id null for "All"). */
function getFolderPathBreadcrumb(folderId, folders) {
  if (!folderId || !folders?.length) return [{ id: null, name: 'All' }];
  const byId = new Map((folders || []).map((f) => [f.id, f]));
  const path = [];
  let current = byId.get(folderId);
  while (current) {
    path.push({ id: current.id, name: current.name });
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  path.reverse();
  return [{ id: null, name: 'All' }, ...path];
}

export default function NoteEditor({ note, folders = [], onNavigateToFolder, onDeleted, onSaved, autoSave = true, fontSize = 'medium', flushSaveRef, editorScrollRef, onSemanticLinkClick, onDefineTerm }) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [status, setStatus] = useState(''); // 'saving' | 'saved' | 'error' | ''
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef(null);
  const titleContentRef = useRef({ title: note?.title ?? '', content: note?.content ?? '' });
  titleContentRef.current = { title, content };

  // Sync title and content from note when switching notes. Editor gets initialContent from
  // note.content (prop) so it always displays the correct note; we sync local state for save.
  useEffect(() => {
    setTitle(note?.title ?? '');
    setContent(note?.content ?? '');
  }, [note?.id, note?.title, note?.content]);

  const performSave = useCallback(async () => {
    if (!note?.id) return;
    setSaving(true);
    setStatus('saving');
    try {
      const updated = await updateNote(note.id, { title, content });
      setStatus('saved');
      setSaving(false);
      setTimeout(() => setStatus(''), 2000);
      onSaved?.(updated);
    } catch (e) {
      setStatus('error');
      setSaving(false);
    }
  }, [note?.id, title, content]);

  // Debounced auto-save when autoSave is on.
  useEffect(() => {
    if (!autoSave || !note?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(performSave, DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, autoSave, note?.id, performSave]);

  // Expose flush so parent can save pending changes before switching notes.
  const flushSave = useCallback(async () => {
    if (!note?.id) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const { title: t, content: c } = titleContentRef.current;
    if (t !== (note?.title ?? '') || c !== (note?.content ?? '')) {
      setSaving(true);
      setStatus('saving');
      try {
        const updated = await updateNote(note.id, { title: t, content: c });
        setStatus('saved');
        setSaving(false);
        setTimeout(() => setStatus(''), 2000);
        onSaved?.(updated);
      } catch (e) {
        setStatus('error');
        setSaving(false);
      }
    }
  }, [note?.id, note?.title, note?.content, onSaved]);

  useEffect(() => {
    if (!flushSaveRef) return;
    flushSaveRef.current = flushSave;
    return () => { flushSaveRef.current = null; };
  }, [flushSaveRef, flushSave]);

  const handleSaveClick = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    performSave();
  };

  if (!note) return null;

  const createdDate = note.createdAt
    ? (note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt)).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '';

  const folderBreadcrumb = useMemo(
    () => getFolderPathBreadcrumb(note.folderId, folders),
    [note.folderId, folders]
  );

  return (
    <div className="note-editor-panel">
      <div className="note-editor-header">
        <div className="note-editor-meta">
          {folderBreadcrumb.length > 0 && (
            <nav className="note-editor-breadcrumb" aria-label="Note location">
              {folderBreadcrumb.map((segment, i) => (
                <span key={segment.id ?? 'all'} className="note-editor-breadcrumb-segment">
                  {i > 0 && <span className="note-editor-breadcrumb-sep" aria-hidden>/</span>}
                  <button
                    type="button"
                    className="note-editor-breadcrumb-link"
                    onClick={() => onNavigateToFolder?.(segment.id)}
                    title={segment.id ? `Open ${segment.name}` : 'Open all notes'}
                    aria-current={i === folderBreadcrumb.length - 1 ? 'location' : undefined}
                  >
                    {segment.name}
                  </button>
                </span>
              ))}
            </nav>
          )}
          {createdDate && <p className="note-editor-created">{createdDate}</p>}
        </div>
        <div className="note-editor-title-row">
          <input
            className="note-editor-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            aria-label="Note title"
          />
          <div className="note-editor-actions">
            {!autoSave && (
              <button type="button" className="btn-primary" onClick={handleSaveClick} disabled={saving}>
                <Save size={18} />
                Save
              </button>
            )}
            {status && <span className="note-editor-status">{status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Error'}</span>}
          </div>
        </div>
      </div>
      <RichTextEditor
        ref={editorScrollRef}
        key={note.id}
        initialContent={note.content ?? ''}
        onContentChange={(html) => setContent(html)}
        fontSize={fontSize}
        onSemanticLinkClick={onSemanticLinkClick}
        onDefineTerm={onDefineTerm}
      />
    </div>
  );
}
