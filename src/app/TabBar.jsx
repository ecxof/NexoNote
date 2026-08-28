/**
 * Tab bar: horizontal pills showing open tabs (empty, note, PDF).
 * Each tab has icon, label, and close button. + button adds empty tab.
 */
import { X, FileText, FileType, Plus } from 'lucide-react';

export default function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onAddEmptyTab }) {
  const getTabIcon = (type) => {
    if (type === 'note') return <FileText size={14} />;
    if (type === 'pdf') return <FileType size={14} />;
    return null;
  };

  const getTabLabel = (tab) => {
    if (tab.type === 'empty') return 'Untitled';
    return tab.label || 'Untitled';
  };

  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-bar-tab ${activeTabId === tab.id ? 'active' : ''}`}
            title={getTabLabel(tab)}
          >
            <button
              type="button"
              className="tab-bar-tab-clickable"
              onClick={() => onTabClick(tab.id)}
              aria-label={`Switch to ${getTabLabel(tab)}`}
            >
              <span className="tab-bar-tab-icon">{getTabIcon(tab.type)}</span>
              <span className="tab-bar-tab-label">{getTabLabel(tab)}</span>
            </button>
            <button
              type="button"
              className="tab-bar-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              aria-label="Close tab"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="tab-bar-add"
        onClick={onAddEmptyTab}
        title="New tab"
        aria-label="New tab"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
