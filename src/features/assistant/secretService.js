/**
 * Secret storage for the Hugging Face API token.
 *
 * The token is deliberately not part of the settings blob. Settings have three
 * writers (Electron IPC, the FastAPI backend, localStorage) and only the first
 * can reach the OS keystore, so a token stored there would be written in the
 * clear whenever the Python backend was active.
 *
 * In Electron the main process encrypts it with safeStorage. In a plain browser
 * there is no equivalent - localStorage is readable by any script on the page -
 * so no storage is offered at all and the AI assistant falls back to the
 * VITE_HF_API_TOKEN build-time variable.
 */

const LEGACY_SETTINGS_KEY = 'hfApiToken';

function secretsApi() {
  return typeof window !== 'undefined' ? window.electronAPI?.secrets : undefined;
}

/** True when this build can store a token at all. False in a plain browser. */
export function canStoreToken() {
  return !!secretsApi();
}

/**
 * Whether a stored token would actually be encrypted.
 * @returns {Promise<{ available: boolean, encrypted: boolean }>}
 */
export async function tokenStorageStatus() {
  const api = secretsApi();
  if (!api) return { available: false, encrypted: false };
  try {
    return await api.status();
  } catch {
    return { available: false, encrypted: false };
  }
}

/**
 * Read the stored token.
 *
 * Also migrates a token left in the settings table by earlier versions, which
 * stored it in plain text, moving it into the encrypted store and clearing the
 * old copy so the plaintext does not linger.
 *
 * @returns {Promise<string>}
 */
export async function getHfToken() {
  const api = secretsApi();
  if (!api) return '';
  try {
    const stored = await api.getHfToken();
    if (stored) return stored;
  } catch {
    return '';
  }

  try {
    const { getSettings, updateSettings } = await import('@/features/settings/settingsService');
    const settings = await getSettings();
    const legacy = (settings?.[LEGACY_SETTINGS_KEY] || '').trim();
    if (!legacy) return '';
    await api.setHfToken(legacy);
    await updateSettings({ [LEGACY_SETTINGS_KEY]: '' });
    return legacy;
  } catch {
    return '';
  }
}

/**
 * Store or clear the token. Passing an empty string removes it.
 * @param {string} value
 * @returns {Promise<{ ok: boolean, encrypted: boolean }>}
 */
export async function setHfToken(value) {
  const api = secretsApi();
  if (!api) return { ok: false, encrypted: false };
  return api.setHfToken(typeof value === 'string' ? value.trim() : '');
}
