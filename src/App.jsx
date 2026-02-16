/**
 * Root: notes, folders, current note, view, clipboard, modals.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { ItemMenuProvider } from './context/ItemMenuContext';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { ConfirmModal, PromptModal } from './components/Modal';
import {
  getNotes,
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
  duplicateNote,
} from './services/noteService';
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from './services/folderService';
import { getSettings } from './services/settingsService';
import { getPdfs, addPdf, updatePdf, removePdf, duplicatePdf } from './services/pdfService';
import { nanoid } from 'nanoid';

const DEFAULT_SETTINGS = { autoSave: true, fontSize: 'medium', theme: 'dark' };

function hasElectron() {
  return typeof window !== 'undefined' && window.electronAPI;
}

function App() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [view, setView] = useState('dashboard');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [copiedPdfId, setCopiedPdfId] = useState(null);
  const [modal, setModal] = useState(null);
  const [noteViewSidebarOpen, setNoteViewSidebarOpen] = useState(true);
  const [noteViewRightSidebarOpen, setNoteViewRightSidebarOpen] = useState(true);
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const editorFlushSaveRef = useRef(null);
  const editorScrollRef = useRef(null);

  const loadNotes = useCallback(async () => {
    const list = await getNotes();
    setNotes(list);
  }, []);

  const loadFolders = useCallback(async () => {
    const list = await getFolders();
    setFolders(list);
  }, []);

  const loadPdfs = useCallback(async () => {
    const list = await getPdfs();
    setPdfs(list);
  }, []);

  const loadSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings({ ...DEFAULT_SETTINGS, ...s });
  }, []);

  useEffect(() => {
    loadNotes();
    loadFolders();
    loadPdfs();
    loadSettings();
  }, [loadNotes, loadFolders, loadPdfs, loadSettings]);

  useEffect(() => {
    const theme = settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [settings.theme]);

  const handleOpenInTab = useCallback(({ type, id }) => {
    // Check if already open
    const existingTab = tabs.find((t) => t.type === type && t.resourceId === id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      setView('editor');
      return;
    }

    // Get label for tab
    let label = 'Untitled';
    if (type === 'note') {
      const note = notes.find((n) => n.id === id);
      label = note?.title || 'Untitled';
    } else if (type === 'pdf') {
      const pdf = pdfs.find((p) => p.id === id);
      label = pdf?.title || 'Untitled PDF';
    }

    const newTab = {
      id: nanoid(),
      type,
      resourceId: id,
      label,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setView('editor');
  }, [tabs, notes, pdfs]);

  const handleCreateNote = useCallback(async (folderId = null) => {
    const note = await createNote(folderId);
    setNotes((prev) => [note, ...prev]);
    // Open in new tab
    handleOpenInTab({ type: 'note', id: note.id });
  }, [handleOpenInTab]);

  // Update tab labels when notes/PDFs are renamed
  useEffect(() => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.type === 'note' && tab.resourceId) {
          const note = notes.find((n) => n.id === tab.resourceId);
          return { ...tab, label: note?.title || 'Untitled' };
        }
        if (tab.type === 'pdf' && tab.resourceId) {
          const pdf = pdfs.find((p) => p.id === tab.resourceId);
          return { ...tab, label: pdf?.title || 'Untitled PDF' };
        }
        return tab;
      })
    );
  }, [notes, pdfs]);

  const handleCloseTab = useCallback((tabId) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        // Switch to another tab or set to null
        if (filtered.length > 0) {
          setActiveTabId(filtered[filtered.length - 1].id);
        } else {
          setActiveTabId(null);
          setView('dashboard');
        }
      }
      return filtered;
    });
  }, [activeTabId]);

  const handleAddEmptyTab = useCallback(() => {
    const newTab = {
      id: nanoid(),
      type: 'empty',
      label: 'Untitled',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setView('editor');
  }, []);

  const handleImportPdf = useCallback(async () => {
    // File picker - simplified for now
    if (typeof window === 'undefined') return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const title = file.name.replace(/\.pdf$/i, '');
      
      // Convert file to data URL (base64) to avoid blob URL security restrictions
      // In Electron, we'd copy file and get path; in browser, use data URL
      let filePath;
      if (hasElectron()) {
        // Electron: use file system path
        filePath = file.path || file.name;
      } else {
        // Browser: convert to data URL
        filePath = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      
      const pdf = await addPdf(filePath, title, null);
      setPdfs((prev) => [pdf, ...prev]);
      handleOpenInTab({ type: 'pdf', id: pdf.id });
    };
    input.click();
  }, [handleOpenInTab]);

  const handleSelectNote = useCallback(async (id) => {
    // Open in tab instead of direct selection
    handleOpenInTab({ type: 'note', id });
  }, [handleOpenInTab]);

  const handleNoteDeleted = useCallback(() => {
    setCurrentNoteId(null);
    setView('dashboard');
    loadNotes();
  }, [loadNotes]);

  const handleNoteSaved = useCallback((updated) => {
    if (!updated?.id) return;
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
  }, []);

  const handleSelectFolder = useCallback((folderId) => {
    setSelectedFolderId(folderId);
    setView('folder');
  }, []);

  const setViewSafe = useCallback((newView) => {
    if (view === 'editor' && newView !== 'editor') {
      const f = editorFlushSaveRef.current;
      if (f) f().then(() => setView(newView));
      else setView(newView);
    } else {
      setView(newView);
    }
  }, [view]);

  const handleBackToDashboard = useCallback(() => setViewSafe('dashboard'), [setViewSafe]);

  /** Navigate from note view to folder view (or dashboard when folderId is null). Flushes editor first. */
  const handleNavigateToFolder = useCallback((folderId) => {
    const apply = () => {
      setSelectedFolderId(folderId);
      setView(folderId === null ? 'dashboard' : 'folder');
    };
    if (view === 'editor') {
      const f = editorFlushSaveRef.current;
      if (f) f().then(apply);
      else apply();
    } else {
      apply();
    }
  }, [view]);

  const handleTagsChange = useCallback(async (note, tags) => {
    if (!note?.id) return;
    const updated = await updateNote(note.id, { ...note, tags });
    if (updated) handleNoteSaved(updated);
  }, [handleNoteSaved]);

  const handleExploreSemanticMap = useCallback(() => {
    setView('semantic-map');
  }, []);

  const handleBackFromSemanticMap = useCallback(() => {
    setView('editor');
  }, []);

  const handleCreateFolder = useCallback((parentId = null) => {
    setModal({
      type: 'prompt',
      title: parentId ? 'New subfolder' : 'New folder',
      initialValue: 'New Folder',
      submitLabel: 'Create',
      onSubmit: async (name) => {
        const folder = await createFolder(name, parentId);
        setFolders((prev) => [...prev, folder]);
      },
    });
  }, []);

  const handleRenameFolder = useCallback((folderId, currentName) => {
    setModal({
      type: 'prompt',
      title: 'Rename folder',
      initialValue: currentName,
      submitLabel: 'Rename',
      onSubmit: async (newName) => {
        const updated = await updateFolder(folderId, { name: newName });
        if (updated) setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f)));
      },
    });
  }, []);

  const handleDeleteFolder = useCallback((folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    setModal({
      type: 'confirm',
      title: 'Delete folder',
      message: folder ? `Delete "${folder.name}"? Notes inside will be moved to All Notes.` : 'Delete this folder?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const ok = await deleteFolder(folderId);
        if (ok) {
          loadFolders();
          loadNotes();
          if (selectedFolderId === folderId) {
            setSelectedFolderId(null);
            setView('dashboard');
          }
        }
      },
    });
  }, [folders, loadFolders, loadNotes, selectedFolderId]);

  const handleRenameNote = useCallback((noteId, currentTitle) => {
    setModal({
      type: 'prompt',
      title: 'Rename note',
      initialValue: currentTitle,
      submitLabel: 'Rename',
      onSubmit: async (newTitle) => {
        const updated = await updateNote(noteId, { title: newTitle });
        if (updated) loadNotes();
      },
    });
  }, [loadNotes]);

  const handleDeleteNote = useCallback((noteId) => {
    setModal({
      type: 'confirm',
      title: 'Delete note',
      message: 'Delete this note? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const ok = await deleteNote(noteId);
        if (ok) {
          loadNotes();
          if (currentNoteId === noteId) {
            setCurrentNoteId(null);
            setView(view === 'editor' ? 'dashboard' : view);
          }
        }
      },
    });
  }, [loadNotes, currentNoteId, view]);

  const handleCopyNote = useCallback((noteId) => {
    setCopiedNoteId(noteId);
  }, []);

  const handlePasteNote = useCallback(async () => {
    if (!copiedNoteId) return;
    try {
      const newNote = await duplicateNote(copiedNoteId, selectedFolderId ?? undefined);
      setNotes((prev) => [newNote, ...prev]);
      setCurrentNoteId(newNote.id);
      setView('editor');
    } catch (e) {
      console.error(e);
    }
  }, [copiedNoteId, selectedFolderId]);

  const handleMoveNoteToFolder = useCallback(async (noteId, folderId) => {
    const updated = await updateNote(noteId, { folderId });
    if (updated) loadNotes();
  }, [loadNotes]);

  /* ---- PDF management handlers (mirror note handlers) ---- */

  const handleRenamePdf = useCallback((pdfId, currentTitle) => {
    setModal({
      type: 'prompt',
      title: 'Rename PDF',
      initialValue: currentTitle,
      submitLabel: 'Rename',
      onSubmit: async (newTitle) => {
        const updated = await updatePdf(pdfId, { title: newTitle });
        if (updated) loadPdfs();
      },
    });
  }, [loadPdfs]);

  const handleDeletePdf = useCallback((pdfId) => {
    const pdf = pdfs.find((p) => p.id === pdfId);
    setModal({
      type: 'confirm',
      title: 'Delete PDF',
      message: pdf ? `Delete "${pdf.title}"? This cannot be undone.` : 'Delete this PDF?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const ok = await removePdf(pdfId);
        if (ok) {
          loadPdfs();
          // Close any open tab for this PDF
          setTabs((prev) => {
            const filtered = prev.filter((t) => !(t.type === 'pdf' && t.resourceId === pdfId));
            if (activeTabId && !filtered.find((t) => t.id === activeTabId)) {
              if (filtered.length > 0) setActiveTabId(filtered[filtered.length - 1].id);
              else { setActiveTabId(null); setView('dashboard'); }
            }
            return filtered;
          });
        }
      },
    });
  }, [pdfs, loadPdfs, activeTabId]);

  const handleCopyPdf = useCallback((pdfId) => {
    setCopiedPdfId(pdfId);
  }, []);

  const handlePastePdf = useCallback(async () => {
    if (!copiedPdfId) return;
    try {
      const newPdf = await duplicatePdf(copiedPdfId, selectedFolderId ?? undefined);
      setPdfs((prev) => [newPdf, ...prev]);
    } catch (e) {
      console.error(e);
    }
  }, [copiedPdfId, selectedFolderId]);

  const handleMovePdfToFolder = useCallback(async (pdfId, folderId) => {
    const updated = await updatePdf(pdfId, { folderId });
    if (updated) loadPdfs();
  }, [loadPdfs]);

  const handleBackToAll = useCallback(() => {
    setSelectedFolderId(null);
    setView('folder');
  }, []);

  useEffect(() => {
    if (view === 'editor' || view === 'dashboard' || view === 'folder') loadSettings();
  }, [view, loadSettings]);

  const currentNote = currentNoteId
    ? notes.find((n) => n.id === currentNoteId) ?? null
    : null;

  const [fetchedNote, setFetchedNote] = useState(null);
  useEffect(() => {
    if (!currentNoteId) {
      setFetchedNote(null);
      return;
    }
    if (notes.some((n) => n.id === currentNoteId)) {
      setFetchedNote(null);
      return;
    }
    getNoteById(currentNoteId).then((n) => setFetchedNote(n));
  }, [currentNoteId, notes]);

  const noteToShow =
    currentNoteId && (currentNote ?? fetchedNote)?.id === currentNoteId
      ? (currentNote ?? fetchedNote)
      : null;

  const selectedFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) ?? null : null;
  const folderNotes =
    view === 'folder'
      ? selectedFolderId
        ? notes.filter((n) => n.folderId === selectedFolderId)
        : notes
      : [];

  return (
    <ItemMenuProvider>
    <div className="app-container">
      {modal?.type === 'confirm' && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          cancelLabel={modal.cancelLabel}
          danger={modal.danger}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'prompt' && (
        <PromptModal
          title={modal.title}
          message={modal.message}
          initialValue={modal.initialValue}
          placeholder={modal.placeholder}
          submitLabel={modal.submitLabel}
          cancelLabel={modal.cancelLabel}
          validate={modal.validate}
          onSubmit={modal.onSubmit}
          onCancel={() => setModal(null)}
        />
      )}
      <Sidebar
        view={view}
        setView={setViewSafe}
        notes={notes}
        folders={folders}
        pdfs={pdfs}
        currentNoteId={currentNoteId}
        selectedFolderId={selectedFolderId}
        onSelectNote={handleSelectNote}
        onSelectFolder={handleSelectFolder}
        onOpenInTab={handleOpenInTab}
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
        onRenameNote={handleRenameNote}
        onDeleteNote={handleDeleteNote}
        onCopyNote={handleCopyNote}
        onPasteNote={handlePasteNote}
        onMoveNoteToFolder={handleMoveNoteToFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        copiedNoteId={copiedNoteId}
        onRenamePdf={handleRenamePdf}
        onDeletePdf={handleDeletePdf}
        onCopyPdf={handleCopyPdf}
        onPastePdf={handlePastePdf}
        onMovePdfToFolder={handleMovePdfToFolder}
        copiedPdfId={copiedPdfId}
      />
      <MainContent
        view={view}
        notes={notes}
        folderNotes={folderNotes}
        pdfs={pdfs}
        currentNoteId={currentNoteId}
        currentNote={noteToShow}
        selectedFolder={selectedFolder}
        folders={folders}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={setActiveTabId}
        onTabClose={handleCloseTab}
        onAddEmptyTab={handleAddEmptyTab}
        onOpenInTab={handleOpenInTab}
        onImportPdf={handleImportPdf}
        onDeleted={handleNoteDeleted}
        onSaved={handleNoteSaved}
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
        onSelectNote={handleSelectNote}
        onSelectFolder={handleSelectFolder}
        onRenameNote={handleRenameNote}
        onDeleteNote={handleDeleteNote}
        onCopyNote={handleCopyNote}
        onPasteNote={handlePasteNote}
        onMoveNoteToFolder={handleMoveNoteToFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onBackToAll={handleBackToAll}
        copiedNoteId={copiedNoteId}
        onRenamePdf={handleRenamePdf}
        onDeletePdf={handleDeletePdf}
        onCopyPdf={handleCopyPdf}
        onPastePdf={handlePastePdf}
        onMovePdfToFolder={handleMovePdfToFolder}
        copiedPdfId={copiedPdfId}
        settings={settings}
        editorFlushSaveRef={editorFlushSaveRef}
        editorScrollRef={editorScrollRef}
        noteViewSidebarOpen={noteViewSidebarOpen}
        onNoteViewSidebarOpenChange={setNoteViewSidebarOpen}
        noteViewRightSidebarOpen={noteViewRightSidebarOpen}
        onNoteViewRightSidebarOpenChange={setNoteViewRightSidebarOpen}
        onBackToDashboard={handleBackToDashboard}
        onNavigateToFolder={handleNavigateToFolder}
        onTagsChange={handleTagsChange}
        onExploreSemanticMap={handleExploreSemanticMap}
        onBackFromSemanticMap={handleBackFromSemanticMap}
        notes={notes}
      />
    </div>
    </ItemMenuProvider>
  );
}

export default App;
