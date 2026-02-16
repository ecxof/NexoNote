/**
 * Settings service: read/write app settings (auto-save, font size).
 * Uses Electron IPC when available, otherwise localStorage.
 */

const STORAGE_KEY = 'nexonote_settings';
const DEFAULTS = {
  autoSave: true,
  fontSize: 'medium',
  theme: 'dark',
  sidebarWidth: 280,
  sidebarCollapsed: false,
};

function hasElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.settings;
}

/** @returns {Promise<{ autoSave: boolean, fontSize: string, theme: string, sidebarWidth: number, sidebarCollapsed: boolean }>} */
export async function getSettings() {
  if (hasElectron()) {
    const raw = await window.electronAPI.settings.get();
    return { ...DEFAULTS, ...raw };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * @param {{ autoSave?: boolean, fontSize?: string, theme?: string, sidebarWidth?: number, sidebarCollapsed?: boolean }} partial
 * @returns {Promise<{ autoSave: boolean, fontSize: string, theme: string }>}
 */
export async function updateSettings(partial) {
  if (hasElectron()) {
    return window.electronAPI.settings.set(partial);
  }
  const current = await getSettings();
  const next = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
