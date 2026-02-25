/**
 * Settings service: read/write app settings (auto-save, font size).
 * Uses Python backend HTTP when URL set, else Electron IPC, else localStorage.
 */

import { getBackendClient } from '../apiClient';

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
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.settings.get();
    return { ...DEFAULTS, ...raw };
  }
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
  const backend = await getBackendClient();
  if (backend) {
    return backend.settings.set(partial);
  }
  if (hasElectron()) {
    return window.electronAPI.settings.set(partial);
  }
  const current = await getSettings();
  const next = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
