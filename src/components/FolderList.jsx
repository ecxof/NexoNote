/**
 * Sidebar folder list with three-dot menu (rename, delete). Click folder to open folder view.
 */
import { Plus, Folder } from 'lucide-react';
import { FolderItemMenu } from './ItemMenu';

export default function FolderList({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) {
  return (
    <div className="sidebar-section">
      <div className="section-header">
        <h3 className="section-title">FOLDERS</h3>
        <button
          type="button"
          className="icon-button"
          onClick={onCreateFolder}
          title="New folder"
          aria-label="New folder"
        >
          <Plus size={16} />
        </button>
      </div>
      <ul className="section-items">
        {folders.map((folder) => (
          <li key={folder.id} className="section-item sidebar-section-item">
            <div className="folder-list-item-wrap">
              <button
                type="button"
                className={`folder-list-item ${selectedFolderId === folder.id ? 'active' : ''}`}
                onClick={() => onSelectFolder(folder.id)}
              >
                <Folder size={16} className="item-icon" />
                <span className="note-list-item-title">{folder.name}</span>
              </button>
              <FolderItemMenu
                folderId={folder.id}
                folderName={folder.name}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
