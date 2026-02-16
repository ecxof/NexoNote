/**
 * Folder view: breadcrumb (full path for nested folders), header, search, sort, grid/list, note cards.
 */
import { useState, useMemo, useRef, useEffect, useLayoutEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Plus, MoreVertical, FileText, FileType, Folder, LayoutGrid, List } from 'lucide-react';
import { NoteItemMenu, PdfItemMenu } from './ItemMenu';
import { ItemMenuContext } from '../context/ItemMenuContext';

function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(undefined, { dateStyle: 'short' });
}

function previewFromContent(html) {
  if (!html || typeof html !== 'string') return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}

/** Build path from root to folder (ancestors first, then folder). */
function getFolderPath(folders, folderId) {
  if (!folderId) return [];
  const path = [];
  let id = folderId;
  while (id) {
    const f = folders.find((x) => x.id === id);
    if (!f) break;
    path.unshift(f);
    id = f.parentId ?? null;
  }
  return path;
}

/** Non-interactive path string for a note's folder (e.g. "All / Folder / Subfolder"). */
function getFolderPathString(folders, folderId) {
  const path = getFolderPath(folders, folderId);
  if (path.length === 0) return 'All';
  return ['All', ...path.map((f) => f.name)].join(' / ');
}

export default function FolderView({
  folder,
  folders,
  notes,
  pdfs = [],
  onCreateNote,
  onSelectNote,
  onSelectFolder,
  onOpenInTab,
  onCreateFolder,
  onRenameNote,
  onDeleteNote,
  onCopyNote,
  onPasteNote,
  onMoveNoteToFolder,
  onRenameFolder,
  onDeleteFolder,
  onBackToAll,
  copiedNoteId,
  onRenamePdf,
  onDeletePdf,
  onCopyPdf,
  onPastePdf,
  onMovePdfToFolder,
  copiedPdfId,
}) {
  const [search, setSearch] = useState('');
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [layout, setLayout] = useState('grid'); // 'grid' | 'list'
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);

  // Combine notes and PDFs for display
  const folderNotes = folder?.id 
    ? notes.filter((n) => n.folderId === folder.id)
    : notes.filter((n) => !n.folderId);
  const folderPdfs = folder?.id
    ? pdfs.filter((p) => p.folderId === folder.id)
    : pdfs.filter((p) => !p.folderId);

  const filteredAndSorted = useMemo(() => {
    let list = [...folderNotes];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          previewFromContent(n.content).toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ta = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
      const tb = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
      return sortNewestFirst ? tb - ta : ta - tb;
    });
    return list;
  }, [folderNotes, search, sortNewestFirst]);

  const filteredAndSortedPdfs = useMemo(() => {
    let list = [...folderPdfs];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => (p.title || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const ta = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
      const tb = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
      return sortNewestFirst ? tb - ta : ta - tb;
    });
    return list;
  }, [folderPdfs, search, sortNewestFirst]);

  const folderName = folder ? folder.name : 'All Notes';
  const breadcrumbPath = useMemo(() => getFolderPath(folders, folder?.id ?? null), [folders, folder?.id]);
  const { register, unregister, closeAllExcept } = useContext(ItemMenuContext);
  const folderMenuTriggerRef = useRef(null);
  const folderMenuDropdownRef = useRef(null);
  const [folderMenuPosition, setFolderMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!folderMenuOpen) return;
    register('folder-view-header-menu', () => setFolderMenuOpen(false));
    return () => unregister('folder-view-header-menu');
  }, [folderMenuOpen, register, unregister]);

  useLayoutEffect(() => {
    if (!folderMenuOpen || !folderMenuTriggerRef.current || !folderMenuDropdownRef.current) return;
    const trigger = folderMenuTriggerRef.current.getBoundingClientRect();
    const dropdown = folderMenuDropdownRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = trigger.left;
    let top = trigger.bottom + 2;
    if (left + dropdown.width + 8 > vw) left = Math.max(8, trigger.right - dropdown.width);
    if (left < 8) left = 8;
    if (top + dropdown.height + 8 > vh) top = trigger.top - dropdown.height - 2;
    if (top < 8) top = 8;
    setFolderMenuPosition({ top, left });
  }, [folderMenuOpen]);

  const openFolderMenu = () => {
    closeAllExcept('folder-view-header-menu');
    setFolderMenuOpen(true);
  };

  useEffect(() => {
    if (!folderMenuOpen) return;
    const close = (e) => {
      if (folderMenuTriggerRef.current?.contains(e.target) || folderMenuDropdownRef.current?.contains(e.target)) return;
      setFolderMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [folderMenuOpen]);

  return (
    <main className="main-content">
      <div className="folder-view">
        <div className="folder-view-breadcrumb">
          <button type="button" onClick={onBackToAll}>
            All
          </button>
          {breadcrumbPath.map((f, i) => (
            <span key={f.id} className="folder-view-breadcrumb-segment">
              <span> / </span>
              {i === breadcrumbPath.length - 1 ? (
                <span className="folder-view-breadcrumb-current">{f.name}</span>
              ) : (
                <button type="button" onClick={() => onSelectFolder(f.id)}>{f.name}</button>
              )}
            </span>
          ))}
        </div>

        <div className="folder-view-header">
          <div className="folder-view-title-row">
            <h1 className="folder-view-title">{folderName}</h1>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onCreateNote(folder?.id ?? null)}
            >
              <Plus size={18} />
              New Note
            </button>
            {folder && onCreateFolder && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onCreateFolder(folder.id)}
              >
                <Folder size={18} />
                New subfolder
              </button>
            )}
            {folder && (
              <div className="item-menu-wrap">
                <button
                  ref={folderMenuTriggerRef}
                  type="button"
                  className="item-menu-trigger"
                  onClick={openFolderMenu}
                  aria-label="Folder options"
                  aria-expanded={folderMenuOpen}
                >
                  <MoreVertical size={18} />
                </button>
                {folderMenuOpen && typeof document !== 'undefined' && createPortal(
                  <div
                    ref={folderMenuDropdownRef}
                    className="item-menu-dropdown item-menu-dropdown-portal folder-view-dropdown"
                    style={{
                      position: 'fixed',
                      top: folderMenuPosition.top,
                      left: folderMenuPosition.left,
                      zIndex: 10050,
                      margin: 0,
                    }}
                  >
                    <button
                      type="button"
                      className="item-menu-item"
                      onClick={() => {
                        onRenameFolder?.(folder.id, folder.name);
                        setFolderMenuOpen(false);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="item-menu-item item-menu-item-danger"
                      onClick={() => {
                        onDeleteFolder?.(folder.id);
                        setFolderMenuOpen(false);
                      }}
                    >
                      Delete
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>

        <div className="folder-view-toolbar">
          <input
            type="search"
            className="folder-view-search"
            placeholder="Search notes in this folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search notes"
          />
          <select
            className="folder-view-sort"
            value={sortNewestFirst ? 'newest' : 'oldest'}
            onChange={(e) => setSortNewestFirst(e.target.value === 'newest')}
            aria-label="Sort by date"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <div className="folder-view-toggle">
            <button
              type="button"
              className={layout === 'grid' ? 'active' : ''}
              onClick={() => setLayout('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              className={layout === 'list' ? 'active' : ''}
              onClick={() => setLayout('list')}
              title="List view"
              aria-label="List view"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <div className={layout === 'grid' ? 'folder-notes-grid' : 'folder-notes-list'}>
          {(() => {
            const showFolders = !search.trim();
            const folderCards = showFolders
              ? (folder ? folders.filter((f) => (f.parentId ?? null) === folder.id) : folders.filter((f) => !f.parentId))
              : [];
            const noteCards = filteredAndSorted;
            const pdfCards = filteredAndSortedPdfs;
            const hasContent = folderCards.length > 0 || noteCards.length > 0 || pdfCards.length > 0;
            if (!hasContent) {
              return (
                <p className="header-subtitle">
                  {search.trim() ? 'No notes match your search.' : folder ? 'No notes in this folder yet.' : 'No folders or notes yet.'}
                </p>
              );
            }
            return (
              <>
                {folderCards.map((f) => (
                  <div
                    key={f.id}
                    className="folder-note-card folder-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectFolder?.(f.id)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectFolder?.(f.id)}
                  >
                    <Folder size={28} className="folder-note-card-icon folder-card-icon" />
                    <h3 className="folder-note-card-title">{f.name}</h3>
                    <div className="folder-note-card-meta">
                      <span>Folder</span>
                    </div>
                  </div>
                ))}
                {noteCards.map((note) => (
                  <div
                    key={note.id}
                    className="folder-note-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenInTab ? onOpenInTab({ type: 'note', id: note.id }) : onSelectNote(note.id)}
                    onKeyDown={(e) => e.key === 'Enter' && (onOpenInTab ? onOpenInTab({ type: 'note', id: note.id }) : onSelectNote(note.id))}
                  >
                    <div className="card-menu" onClick={(e) => e.stopPropagation()}>
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
                    <FileText size={24} className="folder-note-card-icon" />
                    <h3 className="folder-note-card-title">{note.title || 'Untitled'}</h3>
                    <p className="folder-note-card-preview">{previewFromContent(note.content)}</p>
                    {Array.isArray(note.tags) && note.tags.length > 0 && (
                      <div className="folder-note-card-tags">
                        {note.tags.map((tag) => (
                          <span key={tag} className="note-tag">#{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="folder-note-card-meta">
                      <span className="folder-note-card-path">{getFolderPathString(folders, note.folderId)}</span>
                      <span className="folder-note-card-time">{formatDate(note.updatedAt)}</span>
                    </div>
                  </div>
                ))}
                {filteredAndSortedPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="folder-note-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenInTab ? onOpenInTab({ type: 'pdf', id: pdf.id }) : null}
                    onKeyDown={(e) => e.key === 'Enter' && onOpenInTab && onOpenInTab({ type: 'pdf', id: pdf.id })}
                  >
                    <div className="card-menu" onClick={(e) => e.stopPropagation()}>
                      <PdfItemMenu
                        pdfId={pdf.id}
                        pdfTitle={pdf.title || 'Untitled PDF'}
                        onRename={onRenamePdf}
                        onDelete={onDeletePdf}
                        onCopy={onCopyPdf}
                        onPaste={onPastePdf}
                        onMoveToFolder={onMovePdfToFolder}
                        canPaste={!!copiedPdfId}
                        folders={folders}
                      />
                    </div>
                    <FileType size={24} className="folder-note-card-icon" />
                    <h3 className="folder-note-card-title">{pdf.title || 'Untitled PDF'}</h3>
                    <p className="folder-note-card-preview">PDF Document</p>
                    <div className="folder-note-card-meta">
                      <span className="folder-note-card-path">{getFolderPathString(folders, pdf.folderId)}</span>
                      <span className="folder-note-card-time">{formatDate(pdf.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </div>
    </main>
  );
}
