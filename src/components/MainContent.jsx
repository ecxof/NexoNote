/**
 * Main area: Dashboard, Folder view, Note Editor, Semantic Map, or Settings.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, List, PanelRight } from 'lucide-react';
import Dashboard from './Dashboard';
import FolderView from './FolderView';
import NoteEditor from './NoteEditor';
import NoteViewSidebar from './NoteViewSidebar';
import NoteViewRightSidebar from './NoteViewRightSidebar';
import Settings from './Settings';
import TabBar from './TabBar';
import EmptyTabView from './EmptyTabView';
import PDFViewer from './PDFViewer';
import SemanticGraphView from './SemanticGraphView';
import FlashcardsView from './FlashcardsView';
import PerformanceAnalyticsView from './PerformanceAnalyticsView';
import FlashcardManualModal from './FlashcardManualModal';
import FlashcardReviewSession from './FlashcardReviewSession';

const NOTE_VIEW_SIDEBAR_MIN = 200;
const NOTE_VIEW_SIDEBAR_MAX = 420;
const NOTE_VIEW_SIDEBAR_DEFAULT = 260;
const NOTE_VIEW_RIGHT_SIDEBAR_MIN = 240;
const NOTE_VIEW_RIGHT_SIDEBAR_MAX = 420;
const NOTE_VIEW_RIGHT_SIDEBAR_DEFAULT = 280;
const RESIZE_HANDLE_WIDTH = 4;

export default function MainContent({
  view,
  notes,
  folderNotes,
  pdfs,
  selectedFolder,
  folders,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onAddEmptyTab,
  onOpenInTab,
  onImportPdf,
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
  onRenamePdf,
  onDeletePdf,
  onCopyPdf,
  onPastePdf,
  onMovePdfToFolder,
  copiedPdfId,
  settings,
  editorFlushSaveRef,
  editorScrollRef,
  noteViewSidebarOpen,
  onNoteViewSidebarOpenChange,
  noteViewRightSidebarOpen,
  onNoteViewRightSidebarOpenChange,
  onBackToDashboard,
  onNavigateToFolder,
  onTagsChange,
  onExploreSemanticMap,
  onBackFromSemanticMap,
  allNotesForLinking,
  onSemanticLinksReady,
  onSemanticLinksClear,
  flashcardLibraryVersion = 0,
  onFlashcardLibraryRefresh,
  reviewSessionConfig = null,
  onCloseReviewSession,
  onStartReviewSession,
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
        onImportPdf={onImportPdf}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
        onCopyNote={onCopyNote}
        onPasteNote={onPasteNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        copiedNoteId={copiedNoteId}
        folders={folders}
        refreshKey={flashcardLibraryVersion}
        onStartReviewSession={onStartReviewSession}
      />
    );
  }

  if (view === 'folder') {
    const folderPdfs = selectedFolder?.id
      ? (pdfs || []).filter((p) => p.folderId === selectedFolder.id)
      : (pdfs || []).filter((p) => !p.folderId);
    return (
      <FolderView
        folder={selectedFolder}
        folders={folders}
        notes={folderNotes}
        pdfs={folderPdfs}
        onCreateNote={onCreateNote}
        onCreateFolder={onCreateFolder}
        onSelectNote={onSelectNote}
        onSelectFolder={onSelectFolder}
        onOpenInTab={onOpenInTab}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
        onCopyNote={onCopyNote}
        onPasteNote={onPasteNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onBackToAll={onBackToAll}
        copiedNoteId={copiedNoteId}
        onRenamePdf={onRenamePdf}
        onDeletePdf={onDeletePdf}
        onCopyPdf={onCopyPdf}
        onPastePdf={onPastePdf}
        onMovePdfToFolder={onMovePdfToFolder}
        copiedPdfId={copiedPdfId}
      />
    );
  }

  if (view === 'flashcards') {
    return (
      <main className="main-content">
        <FlashcardsView
          notes={notes}
          refreshKey={flashcardLibraryVersion}
          onStartReviewSession={onStartReviewSession}
          onLibraryChanged={onFlashcardLibraryRefresh}
        />
      </main>
    );
  }

  if (view === 'performance-analytics') {
    return (
      <main className="main-content">
        <PerformanceAnalyticsView
          refreshKey={flashcardLibraryVersion}
          onStartReviewSession={onStartReviewSession}
        />
      </main>
    );
  }

  if (view === 'flashcard-review') {
    return (
      <FlashcardReviewSession
        noteId={reviewSessionConfig?.noteId || null}
        topicId={reviewSessionConfig?.topicId || null}
        type={reviewSessionConfig?.type || null}
        dueOnly={reviewSessionConfig?.dueOnly !== false}
        onClose={onCloseReviewSession}
      />
    );
  }

  if (view === 'semantic-map') {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const graphNote = activeTab?.type === 'note' && activeTab?.resourceId
      ? notes.find((n) => n.id === activeTab.resourceId) ?? null
      : null;
    return (
      <main className="main-content main-content-semantic-map">
        <SemanticGraphView
          note={graphNote}
          notes={allNotesForLinking ?? notes}
          onClose={onBackFromSemanticMap}
          onOpenInTab={onOpenInTab}
        />
      </main>
    );
  }

  if (view === 'editor') {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const currentNoteForTab = activeTab?.type === 'note' && activeTab?.resourceId
      ? notes.find((n) => n.id === activeTab.resourceId) ?? null
      : null;
    const currentPdfForTab = activeTab?.type === 'pdf' && activeTab?.resourceId
      ? pdfs.find((p) => p.id === activeTab.resourceId) ?? null
      : null;

    return (
      <WorkspaceLayout
        tabs={tabs}
        activeTab={activeTab}
        currentNote={currentNoteForTab}
        currentPdf={currentPdfForTab}
        folders={folders}
        notes={notes}
        noteViewSidebarOpen={noteViewSidebarOpen}
        onNoteViewSidebarOpenChange={onNoteViewSidebarOpenChange}
        noteViewRightSidebarOpen={noteViewRightSidebarOpen}
        onNoteViewRightSidebarOpenChange={onNoteViewRightSidebarOpenChange}
        onBackToDashboard={onBackToDashboard}
        onNavigateToFolder={onNavigateToFolder}
        onTagsChange={onTagsChange}
        onExploreSemanticMap={onExploreSemanticMap}
        allNotesForLinking={allNotesForLinking ?? notes}
        onSemanticLinksReady={onSemanticLinksReady}
        onSemanticLinksClear={onSemanticLinksClear}
        onOpenInTab={onOpenInTab}
        editorScrollRef={editorScrollRef}
        editorFlushSaveRef={editorFlushSaveRef}
        settings={settings}
        onDeleted={onDeleted}
        onSaved={onSaved}
        onCreateNote={onCreateNote}
        onImportPdf={onImportPdf}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
        onAddEmptyTab={onAddEmptyTab}
        onFlashcardLibraryRefresh={onFlashcardLibraryRefresh}
      />
    );
  }

  return (
    <main className="main-content">
      <Dashboard
        notes={notes}
        onCreateNote={onCreateNote}
        onSelectNote={onSelectNote}
        onImportPdf={onImportPdf}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
        onCopyNote={onCopyNote}
        onPasteNote={onPasteNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        copiedNoteId={copiedNoteId}
        folders={folders}
        refreshKey={flashcardLibraryVersion}
        onStartReviewSession={onStartReviewSession}
      />
    </main>
  );
}

function WorkspaceLayout({
  tabs,
  activeTab,
  currentNote,
  currentPdf,
  folders,
  notes,
  noteViewSidebarOpen,
  onNoteViewSidebarOpenChange,
  noteViewRightSidebarOpen,
  onNoteViewRightSidebarOpenChange,
  onBackToDashboard,
  onNavigateToFolder,
  onTagsChange,
  onExploreSemanticMap,
  allNotesForLinking,
  onSemanticLinksReady,
  onSemanticLinksClear,
  onOpenInTab,
  editorScrollRef,
  editorFlushSaveRef,
  settings,
  onDeleted,
  onSaved,
  onCreateNote,
  onImportPdf,
  onTabClick,
  onTabClose,
  onAddEmptyTab,
  onFlashcardLibraryRefresh,
}) {
  const [sidebarWidth, setSidebarWidth] = useState(NOTE_VIEW_SIDEBAR_DEFAULT);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(NOTE_VIEW_RIGHT_SIDEBAR_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);
  const [isRightDragging, setIsRightDragging] = useState(false);
  const [manualModalNote, setManualModalNote] = useState(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(sidebarWidth);
  const startRightWidthRef = useRef(rightSidebarWidth);

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

  const handleRightResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startRightWidthRef.current = rightSidebarWidth;
    setIsRightDragging(true);
  }, [rightSidebarWidth]);

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

  useEffect(() => {
    if (!isRightDragging) return;
    const move = (e) => {
      const delta = startXRef.current - e.clientX;
      const next = Math.min(NOTE_VIEW_RIGHT_SIDEBAR_MAX, Math.max(NOTE_VIEW_RIGHT_SIDEBAR_MIN, startRightWidthRef.current + delta));
      setRightSidebarWidth(next);
    };
    const up = () => setIsRightDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [isRightDragging]);

  const currentSidebarWidth = noteViewSidebarOpen ? sidebarWidth : 0;
  const currentRightSidebarWidth = noteViewRightSidebarOpen ? rightSidebarWidth : 0;

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
            note={activeTab?.type === 'note' ? currentNote : null}
            notes={allNotesForLinking ?? notes}
            allTags={allTags}
            onBack={onBackToDashboard}
            onCollapse={() => onNoteViewSidebarOpenChange(false)}
            onTagsChange={onTagsChange}
            onExploreSemanticMap={onExploreSemanticMap}
            onHeadingClick={(index) => editorScrollRef?.current?.scrollToHeadingIndex(index)}
            onOpenInTab={onOpenInTab}
            onSemanticLinksReady={onSemanticLinksReady}
            onSemanticLinksClear={onSemanticLinksClear}
          />
        </div>
        {noteViewSidebarOpen && (
          <div
            className="note-view-resize-handle"
            onMouseDown={handleResizeMouseDown}
            aria-hidden
          />
        )}
        <div className={`note-view-editor-wrap${!noteViewSidebarOpen ? ' note-view-editor-wrap-sidebar-closed' : ''}${!noteViewRightSidebarOpen ? ' note-view-editor-wrap-right-closed' : ''}`}>
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
          <div className="workspace-content">
            <TabBar
              tabs={tabs}
              activeTabId={activeTab?.id ?? null}
              onTabClick={onTabClick}
              onTabClose={onTabClose}
              onAddEmptyTab={onAddEmptyTab}
            />
            <div className="workspace-content-area">
              {!activeTab || activeTab.type === 'empty' ? (
                <EmptyTabView onCreateNote={onCreateNote} onImportPdf={onImportPdf} />
              ) : activeTab.type === 'note' && currentNote ? (
                <NoteEditor
                  note={currentNote}
                  folders={folders}
                  onNavigateToFolder={onNavigateToFolder}
                  onDeleted={onDeleted}
                  onSaved={onSaved}
                  autoSave={settings.autoSave}
                  fontSize={settings.fontSize}
                  flushSaveRef={editorFlushSaveRef}
                  editorScrollRef={editorScrollRef}
                  onSemanticLinkClick={(noteId) => onOpenInTab?.({ type: 'note', id: noteId })}
                />
              ) : activeTab.type === 'pdf' && currentPdf ? (
                <PDFViewer
                  pdf={currentPdf}
                  onExport={async (pdf, highlights) => {
                    if (typeof window !== 'undefined' && window.electronAPI?.pdfs?.export) {
                      try {
                        const folderPath = await window.electronAPI.pdfs.export(pdf, highlights);
                        if (folderPath) console.log('PDF exported to:', folderPath);
                      } catch (e) {
                        console.error('Export failed:', e);
                      }
                    } else {
                      // Browser fallback: open PDF in new window for print
                      const embed = document.querySelector('.pdf-viewer-iframe');
                      if (embed?.src) {
                        window.open(embed.src, '_blank');
                      }
                    }
                  }}
                />
              ) : (
                <EmptyTabView onCreateNote={onCreateNote} onImportPdf={onImportPdf} />
              )}
            </div>
          </div>
          {!noteViewRightSidebarOpen && (
            <button
              type="button"
              className="note-view-show-right-sidebar-btn"
              onClick={() => onNoteViewRightSidebarOpenChange(true)}
              aria-label="Show right sidebar"
            >
              <PanelRight size={20} />
            </button>
          )}
        </div>
        {noteViewRightSidebarOpen && (
          <div
            className="note-view-resize-handle note-view-resize-handle-right"
            onMouseDown={handleRightResizeMouseDown}
            aria-hidden
          />
        )}
        <div
          className="note-view-right-sidebar-wrap"
          style={{
            width: currentRightSidebarWidth,
            minWidth: currentRightSidebarWidth,
            transition: isRightDragging ? 'none' : 'width 0.2s ease',
          }}
        >
          <NoteViewRightSidebar
            note={activeTab?.type === 'note' ? currentNote : null}
            onCollapse={() => onNoteViewRightSidebarOpenChange(false)}
            onManualCreateFlashcard={(note) => {
              if (!note?.id) return;
              setManualModalNote(note);
            }}
            onExport={activeTab?.type === 'note' ? async () => {
              // Export note to PDF
              if (!currentNote) return;
              
              try {
                // Create a temporary HTML document with note content
                const htmlContent = `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="UTF-8">
                      <title>${currentNote.title || 'Untitled Note'}</title>
                      <style>
                        body {
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                          padding: 2rem;
                          max-width: 800px;
                          margin: 0 auto;
                          line-height: 1.6;
                          color: #333;
                        }
                        h1 { font-size: 2rem; margin-bottom: 1rem; }
                        h2 { font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                        h3 { font-size: 1.25rem; margin-top: 1.25rem; margin-bottom: 0.5rem; }
                        p { margin-bottom: 1rem; }
                        strong { font-weight: 600; }
                        em { font-style: italic; }
                        code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
                        pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
                        ul, ol { margin-left: 1.5rem; margin-bottom: 1rem; }
                        blockquote { border-left: 4px solid #ddd; padding-left: 1rem; margin-left: 0; color: #666; }
                        .note-meta {
                          font-size: 0.875rem;
                          color: #666;
                          margin-bottom: 2rem;
                          padding-bottom: 1rem;
                          border-bottom: 1px solid #eee;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="note-meta">
                        <strong>${currentNote.title || 'Untitled Note'}</strong><br>
                        Created: ${currentNote.createdAt ? new Date(currentNote.createdAt).toLocaleDateString() : 'Unknown'}
                      </div>
                      ${currentNote.content || '<p>No content</p>'}
                    </body>
                  </html>
                `;

                // Create blob and download
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                
                // Use print dialog to save as PDF
                const printWindow = window.open(url, '_blank');
                if (printWindow) {
                  printWindow.onload = () => {
                    setTimeout(() => {
                      printWindow.print();
                      // Clean up after a delay
                      setTimeout(() => {
                        printWindow.close();
                        URL.revokeObjectURL(url);
                      }, 1000);
                    }, 500);
                  };
                } else {
                  // Fallback: direct download
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${currentNote.title || 'Untitled Note'}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 100);
                }
              } catch (error) {
                console.error('Export failed:', error);
                alert('Failed to export note. Please try again.');
              }
            } : undefined}
          />
        </div>
      </div>
      {manualModalNote && (
        <FlashcardManualModal
          note={manualModalNote}
          onClose={() => setManualModalNote(null)}
          onSaved={onFlashcardLibraryRefresh}
        />
      )}
    </main>
  );
}
