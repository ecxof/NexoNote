/**
 * Resizable, collapsible sidebar with unified Notes & Folders tree.
 * Width and collapsed state persist across sessions.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Home, Folder, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import SidebarTree from './SidebarTree';
import { getSettings, updateSettings } from '../services/settingsService';

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 280;
const COLLAPSED_WIDTH = 56;
const RESIZE_HANDLE_WIDTH = 4;

export default function Sidebar({
  view,
  setView,
  notes,
  folders,
  currentNoteId,
  selectedFolderId,
  onSelectNote,
  onSelectFolder,
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
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.sidebarWidth != null) setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, s.sidebarWidth)));
      if (s.sidebarCollapsed != null) setCollapsed(s.sidebarCollapsed);
    });
  }, []);

  useEffect(() => {
    if (view === 'editor') {
      setCollapsed(true);
    } else {
      getSettings().then((s) => {
        if (s.sidebarCollapsed != null) setCollapsed(s.sidebarCollapsed);
      });
    }
  }, [view]);

  const persistWidth = useCallback((w) => {
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
    setWidth(clamped);
    updateSettings({ sidebarWidth: clamped });
  }, []);

  const persistCollapsed = useCallback((c) => {
    setCollapsed(c);
    updateSettings({ sidebarCollapsed: c });
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    setIsDragging(true);
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    const move = (e) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      persistWidth(newWidth);
    };
    const up = () => setIsDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [isDragging, persistWidth]);

  const toggleFolder = useCallback((folderId) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const currentWidth = collapsed ? COLLAPSED_WIDTH : width;
  const wrapperWidth = collapsed ? currentWidth : currentWidth + RESIZE_HANDLE_WIDTH;

  return (
    <div className="sidebar-wrapper" style={{ width: wrapperWidth, minWidth: wrapperWidth, flexShrink: 0, display: 'flex' }}>
      <aside
        ref={sidebarRef}
        className={`sidebar sidebar-resizable ${collapsed ? 'sidebar-collapsed' : ''}`}
        style={{ width: currentWidth, minWidth: currentWidth, maxWidth: currentWidth }}
      >
        <div className="sidebar-inner">
          <div className="sidebar-header">
            <div className="sidebar-logo-container">
              <div className="sidebar-logo-icon">📚</div>
              {!collapsed && <h1 className="sidebar-logo-text">NexoNote</h1>}
            </div>
          </div>

          <nav className="sidebar-nav">
            <ul className="sidebar-menu">
              <li className="sidebar-menu-item">
                <button
                  type="button"
                  className={`sidebar-menu-link sidebar-link-pill ${view === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setView('dashboard')}
                  title="Home"
                >
                  <Home size={20} className="menu-icon" />
                  {!collapsed && <span className="menu-label">Home</span>}
                </button>
              </li>
              <li className="sidebar-menu-item">
                <button
                  type="button"
                  className={`sidebar-menu-link sidebar-link-pill ${view === 'folder' ? 'active' : ''}`}
                  onClick={() => setView('folder')}
                  title="Folders"
                >
                  <Folder size={20} className="menu-icon" />
                  {!collapsed && <span className="menu-label">Folders</span>}
                </button>
              </li>
              <li className="sidebar-menu-item">
                <button
                  type="button"
                  className={`sidebar-menu-link sidebar-link-pill ${view === 'settings' ? 'active' : ''}`}
                  onClick={() => setView('settings')}
                  title="Settings"
                >
                  <Settings size={20} className="menu-icon" />
                  {!collapsed && <span className="menu-label">Settings</span>}
                </button>
              </li>
            </ul>
          </nav>

          {!collapsed ? (
            <SidebarTree
              notes={notes}
              folders={folders}
              currentNoteId={currentNoteId}
              selectedFolderId={selectedFolderId}
              view={view}
              expandedFolderIds={expandedFolderIds}
              onToggleFolder={toggleFolder}
              onSelectNote={onSelectNote}
              onSelectFolder={onSelectFolder}
              onCreateNote={onCreateNote}
              onCreateFolder={onCreateFolder}
              onRenameNote={onRenameNote}
              onDeleteNote={onDeleteNote}
              onCopyNote={onCopyNote}
              onPasteNote={onPasteNote}
              onMoveNoteToFolder={onMoveNoteToFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              copiedNoteId={copiedNoteId}
            />
          ) : null}

          <div className="sidebar-footer" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => persistCollapsed(!collapsed)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            </button>
          </div>
        </div>
      </aside>
      {!collapsed && (
        <div
          className={`sidebar-resize-handle ${isDragging ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={width}
        />
      )}
    </div>
  );
}
