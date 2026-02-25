/**
 * HTTP client for the NexoNote Python backend.
 * Mirrors the shape of window.electronAPI so services can swap IPC vs HTTP.
 * Use when Electron is present and getBackendUrl() returns a URL.
 */

/**
 * @param {string} baseUrl - e.g. "http://127.0.0.1:8765"
 * @returns {Promise<Response>} - throws on non-2xx
 */
async function request(baseUrl, path, options = {}) {
  const url = path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    let err;
    try {
      err = new Error(JSON.parse(text).detail || res.statusText);
    } catch {
      err = new Error(text || res.statusText);
    }
    err.status = res.status;
    throw err;
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

/**
 * @param {string} baseUrl
 * @returns {object} - API object matching electronAPI shape (notes, folders, pdfs, settings, flashcards)
 */
export function createBackendClient(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  return {
    notes: {
      getAll: () => request(base, '/api/notes'),
      getById: (id) => request(base, `/api/notes/${id}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      create: (folderId) => request(base, '/api/notes', { method: 'POST', body: JSON.stringify({ folderId: folderId ?? null }) }),
      update: (id, payload) => request(base, `/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      delete: async (id) => {
        const body = await request(base, `/api/notes/${id}`, { method: 'DELETE' });
        return typeof body === 'object' && body !== null && 'ok' in body ? body.ok : !!body;
      },
    },
    folders: {
      getAll: () => request(base, '/api/folders'),
      create: (name, parentId) => request(base, '/api/folders', { method: 'POST', body: JSON.stringify({ name, parentId: parentId ?? null }) }),
      update: (id, payload) => request(base, `/api/folders/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      delete: async (id) => {
        const body = await request(base, `/api/folders/${id}`, { method: 'DELETE' });
        return typeof body === 'object' && body !== null && 'ok' in body ? body.ok : !!body;
      },
    },
    pdfs: {
      getAll: () => request(base, '/api/pdfs'),
      getById: (id) => request(base, `/api/pdfs/${id}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      add: (filePath, title, folderId) => request(base, '/api/pdfs', { method: 'POST', body: JSON.stringify({ filePath, title, folderId: folderId ?? null }) }),
      update: (id, payload) => request(base, `/api/pdfs/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      remove: async (id) => {
        const body = await request(base, `/api/pdfs/${id}`, { method: 'DELETE' });
        return typeof body === 'object' && body !== null && 'ok' in body ? body.ok : !!body;
      },
    },
    settings: {
      get: () => request(base, '/api/settings'),
      set: (partial) => request(base, '/api/settings', { method: 'PUT', body: JSON.stringify(partial) }),
    },
    flashcards: {
      getAll: (filters = {}) => {
        const q = new URLSearchParams();
        if (filters.status != null) q.set('status', filters.status);
        if (filters.type != null) q.set('type', filters.type);
        if (filters.noteId != null) q.set('noteId', filters.noteId);
        if (filters.topicId != null) q.set('topicId', filters.topicId);
        if (filters.dueOnly != null) q.set('dueOnly', String(filters.dueOnly));
        if (filters.now != null) q.set('now', filters.now);
        const query = q.toString();
        return request(base, `/api/flashcards${query ? `?${query}` : ''}`);
      },
      getLibrary: () => request(base, '/api/flashcards/library'),
      getById: (id) => request(base, `/api/flashcards/${id}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      create: (payload) => request(base, '/api/flashcards', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id, payload) => request(base, `/api/flashcards/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      delete: async (id) => {
        const body = await request(base, `/api/flashcards/${id}`, { method: 'DELETE' });
        return typeof body === 'object' && body !== null && 'ok' in body ? body.ok : Boolean(body);
      },
      getDue: (filters = {}) => {
        const q = new URLSearchParams();
        if (filters.noteId != null) q.set('noteId', filters.noteId);
        if (filters.topicId != null) q.set('topicId', filters.topicId);
        if (filters.type != null) q.set('type', filters.type);
        if (filters.now != null) q.set('now', filters.now);
        if (filters.limit != null) q.set('limit', String(filters.limit));
        const query = q.toString();
        return request(base, `/api/flashcards/due${query ? `?${query}` : ''}`);
      },
      review: (id, rating, reviewedAt, reviewMeta) =>
        request(base, `/api/flashcards/${id}/review`, {
          method: 'POST',
          body: JSON.stringify({
            rating: Number(rating),
            reviewedAt: reviewedAt ?? undefined,
            reviewMeta: reviewMeta ?? undefined,
          }),
        }),
      getPerformanceAnalytics: (filters = {}) => {
        const q = new URLSearchParams();
        if (filters.days != null) q.set('days', String(filters.days));
        if (filters.now != null) q.set('now', filters.now);
        const query = q.toString();
        return request(base, `/api/flashcards/analytics${query ? `?${query}` : ''}`);
      },
    },
  };
}

/** @returns {Promise<string | null>} - backend base URL when in Electron with Python backend, else null */
export async function getBackendUrl() {
  if (typeof window === 'undefined' || !window.electronAPI?.getBackendUrl) return null;
  try {
    const url = await window.electronAPI.getBackendUrl();
    return url && typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<object | null>} - backend client when URL is available, else null
 */
export async function getBackendClient() {
  const url = await getBackendUrl();
  return url ? createBackendClient(url) : null;
}
