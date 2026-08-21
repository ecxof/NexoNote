/**
 * Basic settings: auto-save, font size, theme, and the AI assistant token.
 * Persisted via settingsService; parent reads settings and passes to editor.
 */
import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/settingsService';

export default function Settings() {
  const [autoSave, setAutoSave] = useState(true);
  const [fontSize, setFontSize] = useState('medium');
  const [theme, setTheme] = useState('dark');
  const [hfApiToken, setHfApiToken] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenStatus, setTokenStatus] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      setAutoSave(s.autoSave ?? true);
      setFontSize(s.fontSize ?? 'medium');
      setTheme(s.theme ?? 'dark');
      setHfApiToken(s.hfApiToken ?? '');
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

  // Saved on blur rather than per keystroke, so a partially typed token is not
  // written to storage on every character.
  const handleTokenBlur = async () => {
    const trimmed = hfApiToken.trim();
    if (trimmed !== hfApiToken) setHfApiToken(trimmed);
    await updateSettings({ hfApiToken: trimmed });
    setTokenStatus(trimmed ? 'Saved' : 'Cleared');
    setTimeout(() => setTokenStatus(''), 2000);
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
      <div className="settings-section">
        <h3>AI Assistant</h3>
        <div className="settings-row">
          <span className="settings-label">Hugging Face API token</span>
          <div className="settings-token-field">
            <input
              className="settings-input"
              type={tokenVisible ? 'text' : 'password'}
              value={hfApiToken}
              onChange={(e) => setHfApiToken(e.target.value)}
              onBlur={handleTokenBlur}
              placeholder="hf_..."
              autoComplete="off"
              spellCheck="false"
              aria-label="Hugging Face API token"
            />
            <button
              type="button"
              className="settings-token-toggle"
              onClick={() => setTokenVisible((v) => !v)}
              aria-label={tokenVisible ? 'Hide token' : 'Show token'}
            >
              {tokenVisible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <p className="settings-hint">
          Needed for Explain This, Summarize, and Quiz Me. Create one at{' '}
          <a
            href="https://huggingface.co/settings/tokens"
            target="_blank"
            rel="noreferrer noopener"
          >
            huggingface.co/settings/tokens
          </a>
          . Stored in plain text in your local app data, and sent only to Hugging Face.
          If left empty, the <code>VITE_HF_API_TOKEN</code> build-time variable is used.
          {tokenStatus ? <strong> {tokenStatus}</strong> : null}
        </p>
      </div>
    </div>
  );
}
