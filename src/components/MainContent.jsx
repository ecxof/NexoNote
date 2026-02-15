/**
 * Main area: Dashboard, Folder view, Note Editor, Semantic Map, or Settings.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, List } from 'lucide-react';
import Dashboard from './Dashboard';
import FolderView from './FolderView';
import NoteEditor from './NoteEditor';
import NoteViewSidebar from './NoteViewSidebar';
import Settings from './Settings';

const NOTE_VIEW_SIDEBAR_MIN = 200;
const NOTE_VIEW_SIDEBAR_MAX = 420;
const NOTE_VIEW_SIDEBAR_DEFAULT = 260;
const RESIZE_HANDLE_WIDTH = 4;

export default function MainContent({
  view,
  notes,
  folderNotes,
  currentNoteId,
  currentNote,
  selectedFolder,
  folders,
  onDeleted,
  onSaved,
  onCreateNote,
  onCreateFolder,
  onSelectNote,
  onSelectFolder,
  onRenameNote,
  onDeleteNote,
  onCopyNote,
  onPasteNote,
  onMoveNoteToFolder,
  onRenameFolder,
  onDeleteFolder,
  onBackToAll,
  copiedNoteId,
  settings,
  editorFlushSaveRef,
  editorScrollRef,
  noteViewSidebarOpen,
  onNoteViewSidebarOpenChange,
  onBackToDashboard,
  onTagsChange,
  onExploreSemanticMap,
  onBackFromSemanticMap,
}) {
  if (view === 'settings') {
    return (
      <main className="main-content">
        <Settings />
      </main>
    );
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        notes={notes}
        onCreateNote={onCreateNote}
        onSelectNote={onSelectNote}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
        onCopyNote={onCopyNote}
        onPasteNote={onPasteNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        copiedNoteId={copiedNoteId}
        folders={folders}
      />
    );
  }

  if (view === 'folder') {
    return (
      <FolderView
        folder={selectedFolder}
        folders={folders}
        notes={folderNotes}
        onCreateNote={onCreateNote}
        onCreateFolder={onCreateFolder}
        onSelectNote={onSelectNote}
        onSelectFolder={onSelectFolder}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
        onCopyNote={onCopyNote}
        onPasteNote={onPasteNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onBackToAll={onBackToAll}
        copiedNoteId={copiedNoteId}
      />
    );
  }

  if (view === 'semantic-map') {
    return (
      <main className="main-content main-content-semantic-map">
        <div className="semantic-map-screen">
          <button
            type="button"
            className="semantic-map-back"
            onClick={onBackFromSemanticMap}
            aria-label="Back to note"
          >
            <ArrowLeft size={20} />
            Back to note
          </button>
          <p className="semantic-map-placeholder">Semantic map (coming later).</p>
        </div>
      </main>
    );
  }

  if (view === 'editor' && currentNoteId && currentNote?.id === currentNoteId) {
    return (
      <NoteViewEditorLayout
        currentNote={currentNote}
        noteViewSidebarOpen={noteViewSidebarOpen}
        onNoteViewSidebarOpenChange={onNoteViewSidebarOpenChange}
        onBackToDashboard={onBackToDashboard}
        onTagsChange={onTagsChange}
        onExploreSemanticMap={onExploreSemanticMap}
        notes={notes}
        editorScrollRef={editorScrollRef}
        editorFlushSaveRef={editorFlushSaveRef}
        settings={settings}
        onDeleted={onDeleted}
        onSaved={onSaved}
      />
    );
  }

  if (view === 'editor' && currentNoteId) {
    return (
      <main className="main-content">
        <div className="main-content-header">
          <p className="header-subtitle">Loading note…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <Dashboard
        notes={notes}
        onCreateNote={onCreateNote}
        onSelectNote={onSelectNote}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
        onCopyNote={onCopyNote}
        onPasteNote={onPasteNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        copiedNoteId={copiedNoteId}
        folders={folders}
      />
    </main>
  );
}

function NoteViewEditorLayout({
  currentNote,
  notes,
  noteViewSidebarOpen,
  onNoteViewSidebarOpenChange,
  onBackToDashboard,
  onTagsChange,
  onExploreSemanticMap,
  editorScrollRef,
  editorFlushSaveRef,
  settings,
  onDeleted,
  onSaved,
}) {
  const [sidebarWidth, setSidebarWidth] = useState(NOTE_VIEW_SIDEBAR_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(sidebarWidth);

  const allTags = useMemo(
    () => [...new Set((notes || []).flatMap((n) => n.tags || []))].filter(Boolean).sort(),
    [notes]
  );

  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    setIsDragging(true);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isDragging) return;
    const move = (e) => {
      const delta = e.clientX - startXRef.current;
      const next = Math.min(NOTE_VIEW_SIDEBAR_MAX, Math.max(NOTE_VIEW_SIDEBAR_MIN, startWidthRef.current + delta));
      setSidebarWidth(next);
    };
    const up = () => setIsDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [isDragging]);

  const currentSidebarWidth = noteViewSidebarOpen ? sidebarWidth : 0;

  return (
    <main className="main-content main-content-note-view">
      <div className="note-view-layout">
        <div
          className="note-view-sidebar-wrap"
          style={{
            width: currentSidebarWidth,
            minWidth: currentSidebarWidth,
            transition: isDragging ? 'none' : 'width 0.2s ease',
          }}
        >
          <NoteViewSidebar
            note={currentNote}
            allTags={allTags}
            onBack={onBackToDashboard}
            onCollapse={() => onNoteViewSidebarOpenChange(false)}
            onTagsChange={onTagsChange}
            onExploreSemanticMap={onExploreSemanticMap}
            onHeadingClick={(index) => editorScrollRef?.current?.scrollToHeadingIndex(index)}
          />
        </div>
        {noteViewSidebarOpen && (
          <div
            className="note-view-resize-handle"
            onMouseDown={handleResizeMouseDown}
            aria-hidden
          />
        )}
        <div className={`note-view-editor-wrap${!noteViewSidebarOpen ? ' note-view-editor-wrap-sidebar-closed' : ''}`}>
          {!noteViewSidebarOpen && (
            <button
              type="button"
              className="note-view-show-sidebar-btn"
              onClick={() => onNoteViewSidebarOpenChange(true)}
              aria-label="Show sidebar"
            >
              <List size={20} />
            </button>
          )}
          <NoteEditor
            note={currentNote}
            onDeleted={onDeleted}
            onSaved={onSaved}
            autoSave={settings.autoSave}
            fontSize={settings.fontSize}
            flushSaveRef={editorFlushSaveRef}
            editorScrollRef={editorScrollRef}
          />
        </div>
      </div>
    </main>
  );
}
