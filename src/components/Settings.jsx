/**
 * Basic settings: auto-save on/off and default font size.
 * Persisted via settingsService; parent reads settings and passes to editor.
 */
import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/settingsService';

export default function Settings() {
  const [autoSave, setAutoSave] = useState(true);
  const [fontSize, setFontSize] = useState('medium');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    getSettings().then((s) => {
      setAutoSave(s.autoSave ?? true);
      setFontSize(s.fontSize ?? 'medium');
      setTheme(s.theme ?? 'dark');
    });
  }, []);

  const handleAutoSaveChange = (e) => {
    const v = e.target.checked;
    setAutoSave(v);
    updateSettings({ autoSave: v });
  };

  const handleFontSizeChange = (e) => {
    const v = e.target.value;
    setFontSize(v);
    updateSettings({ fontSize: v });
  };

  const handleThemeChange = (e) => {
    const v = e.target.value;
    setTheme(v);
    updateSettings({ theme: v });
    document.documentElement.setAttribute('data-theme', v === 'light' ? 'light' : 'dark');
  };

  return (
    <div className="settings-view">
      <h2 className="recent-notes-title">Settings</h2>
      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="settings-row">
          <span className="settings-label">Theme</span>
          <select
            className="settings-select"
            value={theme}
            onChange={handleThemeChange}
            aria-label="Theme"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>
      <div className="settings-section">
        <h3>Editor</h3>
        <div className="settings-row">
          <span className="settings-label">Auto-save</span>
          <label>
            <input
              type="checkbox"
              checked={autoSave}
              onChange={handleAutoSaveChange}
              aria-label="Auto-save"
            />
            <span style={{ marginLeft: '0.5rem' }}>On</span>
          </label>
        </div>
        <div className="settings-row">
          <span className="settings-label">Font size</span>
          <select
            className="settings-select"
            value={fontSize}
            onChange={handleFontSizeChange}
            aria-label="Font size"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>
    </div>
  );
}
