import { useState } from 'react';
import {
  Search,
  Home,
  Zap,
  TrendingUp,
  Settings,
  Star,
  Plus,
  Edit2,
} from 'lucide-react';

function Sidebar() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'flashcard', label: 'Flashcard', icon: Zap },
    { id: 'analytics', label: 'Performance analytics', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const folders = [
    'Testing Folder 1',
    'Testing Folder 2',
    'Testing Folder 3',
    'Testing Folder 4',
  ];

  return (
    <aside className="sidebar">
      {/* Logo Section */}
      <div className="sidebar-header">
        <div className="sidebar-logo-container">
          <div className="sidebar-logo-icon">📚</div>
          <h1 className="sidebar-logo-text">NexoNote</h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-shortcut">Cmd+K</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <li key={item.id} className="sidebar-menu-item">
                <button
                  className={`sidebar-menu-link ${activeItem === item.id ? 'active' : ''}`}
                  onClick={() => setActiveItem(item.id)}
                  type="button"
                >
                  <IconComponent size={20} className="menu-icon" />
                  <span className="menu-label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Notes Section */}
      <div className="sidebar-section">
        <div className="section-header">
          <h3 className="section-title">NOTES</h3>
        </div>
        <ul className="section-items">
          <li className="section-item">
            <button className="section-item-button" type="button">
              <Star size={16} className="item-icon" />
              <span>Favourite</span>
            </button>
          </li>
        </ul>
      </div>

      {/* Folders Section */}
      <div className="sidebar-section">
        <div className="section-header">
          <h3 className="section-title">FOLDERS</h3>
          <div className="section-actions">
            <button className="icon-button" title="Add folder" type="button">
              <Plus size={16} />
            </button>
            <button className="icon-button" title="Edit folders" type="button">
              <Edit2 size={16} />
            </button>
          </div>
        </div>
        <ul className="section-items">
          {folders.map((folder) => (
            <li key={folder} className="section-item">
              <button className="section-item-button" type="button">
                <span>📁</span>
                <span>{folder}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export default Sidebar;
