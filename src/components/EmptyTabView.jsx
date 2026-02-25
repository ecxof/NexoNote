/**
 * Empty tab view: placeholder when active tab has no content.
 * Shows message to select a file from sidebar or create a new note.
 */
import { FileText, FileType } from 'lucide-react';

export default function EmptyTabView({ onCreateNote, onImportPdf }) {
  return (
    <div className="empty-tab-view">
      <div className="empty-tab-view-content">
        <div className="empty-tab-view-icon">
          <FileText size={48} />
        </div>
        <h2 className="empty-tab-view-title">No file open</h2>
        <p className="empty-tab-view-message">
          Select a file from the sidebar or create a new note to get started.
        </p>
        <div className="empty-tab-view-actions">
          {onCreateNote && (
            <button type="button" className="btn-primary" onClick={() => onCreateNote()}>
              <FileText size={18} />
              Create New Note
            </button>
          )}
          {onImportPdf && (
            <button type="button" className="btn-secondary" onClick={onImportPdf}>
              <FileType size={18} />
              Import PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
