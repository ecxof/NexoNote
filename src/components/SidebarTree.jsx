/**
 * Unified hierarchical tree: All Notes + expandable folders with notes nested inside.
 * Pill-style active state (#1A2942), disclosure arrows, indentation.
 */
import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, FileType, FilePlus, FolderPlus } from 'lucide-react';
import { NoteItemMenu, PdfItemMenu, FolderItemMenu } from './ItemMenu';

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

export default function SidebarTree({
  notes,
  pdfs = [],
  folders,
  currentNoteId,
  selectedFolderId,
  view,
  expandedFolderIds,
  onToggleFolder,
  onSelectNote,
  onSelectFolder,
  onOpenInTab,
  onCreateNote,
  onCreateFolder,
  onRenameNote,
  onDeleteNote,
  onCopyNote,
  onPasteNote,
  onMoveNoteToFolder,
  onRenameFolder,
  onDeleteFolder,
  copiedNoteId,
  onRenamePdf,
  onDeletePdf,
  onCopyPdf,
  onPastePdf,
  onMovePdfToFolder,
  copiedPdfId,
}) {
  const topLevelFolders = folders.filter((f) => !f.parentId);
  const uncategorizedNotes = notes.filter((n) => !n.folderId);
  const uncategorizedPdfs = pdfs.filter((p) => !p.folderId);
  const allNotesActive = view === 'folder' && selectedFolderId === null;
  const isNoteActive = (id) => view === 'editor' && currentNoteId === id;
  const isFolderActive = (id) => view === 'folder' && selectedFolderId === id;
  
  const handleOpenFile = (type, id) => {
    if (onOpenInTab) {
      onOpenInTab({ type, id });
    } else if (type === 'note' && onSelectNote) {
      onSelectNote(id);
    }
  };

  function getChildFolders(parentId) {
    return folders.filter((f) => (f.parentId ?? null) === parentId);
  }

  function renderFolderNode(folder) {
    const isExpanded = expandedFolderIds.has(folder.id);
    const childFolders = getChildFolders(folder.id);
    const folderNotes = notes.filter((n) => n.folderId === folder.id);
    const folderPdfs = pdfs.filter((p) => p.folderId === folder.id);
    const hasChildren = childFolders.length > 0 || folderNotes.length > 0 || folderPdfs.length > 0;

    return (
      <li key={folder.id} className="sidebar-tree-item">
        <div className="sidebar-tree-node-wrap">
          <button
            type="button"
            className="sidebar-tree-chevron-btn"
            onClick={(e) => { e.stopPropagation(); onToggleFolder(folder.id); }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {hasChildren
              ? (isExpanded ? <ChevronDown size={14} className="sidebar-tree-chevron" /> : <ChevronRight size={14} className="sidebar-tree-chevron" />)
              : <span className="sidebar-tree-chevron-spacer" />}
          </button>
          <button
            type="button"
            className={`sidebar-tree-node sidebar-tree-node-pill sidebar-tree-node-folder ${isFolderActive(folder.id) ? 'active' : ''}`}
            onClick={() => onSelectFolder(folder.id)}
          >
            <Folder size={16} className="sidebar-tree-icon" />
            <span className="sidebar-tree-label">{folder.name}</span>
          </button>
          <FolderItemMenu
            folderId={folder.id}
            folderName={folder.name}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
            className="sidebar-tree-menu"
          />
        </div>
        {isExpanded && (childFolders.length > 0 || folderNotes.length > 0 || folderPdfs.length > 0) && (
          <ul className="sidebar-tree-list sidebar-tree-nested">
            {childFolders.map((sub) => renderFolderNode(sub))}
            {folderNotes.map((note) => (
              <li key={note.id} className="sidebar-tree-item">
                <div className="sidebar-tree-node-wrap">
                  <button
                    type="button"
                    className={`sidebar-tree-node sidebar-tree-node-pill sidebar-tree-node-note ${isNoteActive(note.id) ? 'active' : ''}`}
                    onClick={() => handleOpenFile('note', note.id)}
                  >
                    <FileText size={14} className="sidebar-tree-icon" />
                    <span className="sidebar-tree-label">{note.title || 'Untitled'}</span>
                    <span className="sidebar-tree-meta">{formatDate(note.updatedAt)}</span>
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
                    className="sidebar-tree-menu"
                  />
                </div>
              </li>
            ))}
            {folderPdfs.map((pdf) => (
              <li key={pdf.id} className="sidebar-tree-item">
                <div className="sidebar-tree-node-wrap">
                  <button
                    type="button"
                    className="sidebar-tree-node sidebar-tree-node-pill sidebar-tree-node-pdf"
                    onClick={() => handleOpenFile('pdf', pdf.id)}
                  >
                    <FileType size={14} className="sidebar-tree-icon" />
                    <span className="sidebar-tree-label">{pdf.title || 'Untitled PDF'}</span>
                    <span className="sidebar-tree-meta">{formatDate(pdf.updatedAt)}</span>
                  </button>
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
                    className="sidebar-tree-menu"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="sidebar-tree">
      <div className="sidebar-tree-section">
        <div className="sidebar-tree-section-header">
          <span className="sidebar-tree-section-title">Notes</span>
          <div className="sidebar-tree-section-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => onCreateNote(null)}
              title="New note"
              aria-label="New note"
            >
              <FilePlus size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => onCreateFolder(null)}
              title="New folder"
              aria-label="New folder"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        <ul className="sidebar-tree-list">
          {/* All Notes - click shows folder view with no folder selected */}
          <li className="sidebar-tree-item">
            <button
              type="button"
              className={`sidebar-tree-node sidebar-tree-node-pill ${allNotesActive ? 'active' : ''}`}
              onClick={() => onSelectFolder(null)}
            >
              <FileText size={16} className="sidebar-tree-icon" />
              <span className="sidebar-tree-label">All Notes</span>
            </button>
          </li>

          {/* Uncategorized notes and PDFs */}
          {(uncategorizedNotes.length > 0 || uncategorizedPdfs.length > 0) && (
            <li className="sidebar-tree-item sidebar-tree-item-indent">
              <ul className="sidebar-tree-list">
                {uncategorizedNotes.slice(0, 8).map((note) => (
                  <li key={note.id} className="sidebar-tree-item">
                    <div className="sidebar-tree-node-wrap">
                      <button
                        type="button"
                        className={`sidebar-tree-node sidebar-tree-node-pill sidebar-tree-node-note ${isNoteActive(note.id) ? 'active' : ''}`}
                        onClick={() => handleOpenFile('note', note.id)}
                      >
                        <FileText size={14} className="sidebar-tree-icon" />
                        <span className="sidebar-tree-label">{note.title || 'Untitled'}</span>
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
                        className="sidebar-tree-menu"
                      />
                    </div>
                  </li>
                ))}
                {uncategorizedPdfs.slice(0, 8).map((pdf) => (
                  <li key={pdf.id} className="sidebar-tree-item">
                    <div className="sidebar-tree-node-wrap">
                      <button
                        type="button"
                        className="sidebar-tree-node sidebar-tree-node-pill sidebar-tree-node-pdf"
                        onClick={() => handleOpenFile('pdf', pdf.id)}
                      >
                        <FileType size={14} className="sidebar-tree-icon" />
                        <span className="sidebar-tree-label">{pdf.title || 'Untitled PDF'}</span>
                      </button>
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
                        className="sidebar-tree-menu"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          )}

          {topLevelFolders.map((folder) => renderFolderNode(folder))}
          {/* legacy flat list removed in favor of renderFolderNode */ false && folders.map((folder) => {
            const isExpanded = expandedFolderIds.has(folder.id);
            const folderNotes = notes.filter((n) => n.folderId === folder.id);
            return (
              <li key={folder.id} className="sidebar-tree-item">
                <div className="sidebar-tree-node-wrap">
                  <button
                    type="button"
                    className="sidebar-tree-chevron-btn"
                    onClick={(e) => { e.stopPropagation(); onToggleFolder(folder.id); }}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <ChevronDown size={14} className="sidebar-tree-chevron" /> : <ChevronRight size={14} className="sidebar-tree-chevron" />}
                  </button>
                  <button
                    type="button"
                    className={`sidebar-tree-node sidebar-tree-node-pill sidebar-tree-node-folder ${isFolderActive(folder.id) ? 'active' : ''}`}
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <Folder size={16} className="sidebar-tree-icon" />
                    <span className="sidebar-tree-label">{folder.name}</span>
                  </button>
                  <FolderItemMenu
                    folderId={folder.id}
                    folderName={folder.name}
                    onRename={onRenameFolder}
                    onDelete={onDeleteFolder}
                    className="sidebar-tree-menu"
                  />
                </div>
                {isExpanded && (
                  <ul className="sidebar-tree-list sidebar-tree-nested">
                    {folderNotes.map((note) => (
                      <li key={note.id} className="sidebar-tree-item">
                        <div className="sidebar-tree-node-wrap">
                          <button
                            type="button"
                            className={`sidebar-tree-node sidebar-tree-node-pill sidebar-tree-node-note ${isNoteActive(note.id) ? 'active' : ''}`}
                            onClick={() => onSelectNote(note.id)}
                          >
                            <FileText size={14} className="sidebar-tree-icon" />
                            <span className="sidebar-tree-label">{note.title || 'Untitled'}</span>
                            <span className="sidebar-tree-meta">{formatDate(note.updatedAt)}</span>
                          </button>
                          <NoteItemMenu
                            noteId={note.id}
                            noteTitle={note.title || 'Untitled'}
                            onRename={onRenameNote}
                            onDelete={onDeleteNote}
                            onCopy={onCopyNote}
                            onPaste={onPasteNote}
                            onMoveNoteToFolder={onMoveNoteToFolder}
                            canPaste={!!copiedNoteId}
                            folders={folders}
                            className="sidebar-tree-menu"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
