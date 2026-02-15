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

const DEFAULT_SETTINGS = { autoSave: true, fontSize: 'medium' };

function App() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [view, setView] = useState('dashboard');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [modal, setModal] = useState(null);
  const [noteViewSidebarOpen, setNoteViewSidebarOpen] = useState(true);
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

  const loadSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings({ ...DEFAULT_SETTINGS, ...s });
  }, []);

  useEffect(() => {
    loadNotes();
    loadFolders();
    loadSettings();
  }, [loadNotes, loadFolders, loadSettings]);

  const handleCreateNote = useCallback(async (folderId = null) => {
    const note = await createNote(folderId);
    setNotes((prev) => [note, ...prev]);
    setCurrentNoteId(note.id);
    setView('editor');
  }, []);

  const handleSelectNote = useCallback(async (id) => {
    if (view === 'editor' && currentNoteId !== null && currentNoteId !== id) {
      const flush = editorFlushSaveRef.current;
      if (flush) await flush();
    }
    setCurrentNoteId(id);
    setView('editor');
  }, [view, currentNoteId]);

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
        currentNoteId={currentNoteId}
        selectedFolderId={selectedFolderId}
        onSelectNote={handleSelectNote}
        onSelectFolder={handleSelectFolder}
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
      />
      <MainContent
        view={view}
        notes={notes}
        folderNotes={folderNotes}
        currentNoteId={currentNoteId}
        currentNote={noteToShow}
        selectedFolder={selectedFolder}
        folders={folders}
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
        settings={settings}
        editorFlushSaveRef={editorFlushSaveRef}
        editorScrollRef={editorScrollRef}
        noteViewSidebarOpen={noteViewSidebarOpen}
        onNoteViewSidebarOpenChange={setNoteViewSidebarOpen}
        onBackToDashboard={handleBackToDashboard}
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
