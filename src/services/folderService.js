/**
 * Folder service: CRUD for folders. Uses Python backend HTTP when URL set, else Electron IPC or localStorage.
 * Folder shape: { id, name, createdAt }.
 */

import { getBackendClient } from '../apiClient';

const STORAGE_KEY = 'nexonote_folders';

function hasElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.folders;
}

function toFolder(raw) {
  return {
    id: raw.id,
    name: raw.name ?? 'New Folder',
    parentId: raw.parentId ?? null,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
  };
}

/** @returns {Promise<Folder[]>} */
export async function getFolders() {
  const backend = await getBackendClient();
  if (backend) {
    const list = await backend.folders.getAll();
    return list.map(toFolder);
  }
  if (hasElectron()) {
    const list = await window.electronAPI.folders.getAll();
    return list.map(toFolder);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.map(toFolder);
  } catch {
    return [];
  }
}

/** @param {string} [parentId] - parent folder id for nested folders. @returns {Promise<Folder>} */
export async function createFolder(name, parentId = null) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.folders.create(name, parentId);
    return toFolder(raw);
  }
  if (hasElectron()) {
    const raw = await window.electronAPI.folders.create(name, parentId);
    return toFolder(raw);
  }
  const { nanoid } = await import('nanoid');
  const now = new Date().toISOString();
  const folder = { id: nanoid(), name: name || 'New Folder', parentId: parentId ?? null, createdAt: now };
  const list = (await getFolders()).map((f) => ({ ...f, createdAt: f.createdAt?.toISOString?.() ?? f.createdAt }));
  list.push(folder);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return toFolder(folder);
}

/**
 * @param {string} id
 * @param {{ name?: string, parentId?: string | null }} payload
 * @returns {Promise<Folder | null>}
 */
export async function updateFolder(id, payload) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.folders.update(id, payload);
    return raw ? toFolder(raw) : null;
  }
  if (hasElectron()) {
    const raw = await window.electronAPI.folders.update(id, payload);
    return raw ? toFolder(raw) : null;
  }
  const list = await getFolders();
  const index = list.findIndex((f) => f.id === id);
  if (index === -1) return null;
  if (payload.name !== undefined) list[index].name = payload.name;
  if (payload.parentId !== undefined) list[index].parentId = payload.parentId ?? null;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(list.map((f) => ({ ...f, createdAt: f.createdAt?.toISOString?.() ?? f.createdAt })))
  );
  return toFolder(list[index]);
}

/** @returns {Promise<boolean>} */
export async function deleteFolder(id) {
  const backend = await getBackendClient();
  if (backend) {
    return backend.folders.delete(id);
  }
  if (hasElectron()) {
    return window.electronAPI.folders.delete(id);
  }
  const list = await getFolders();
  const folder = list.find((f) => f.id === id);
  if (!folder) return false;
  const parentId = folder.parentId ?? null;
  const filtered = list.filter((f) => f.id !== id).map((f) => {
    const next = { ...f, createdAt: f.createdAt?.toISOString?.() ?? f.createdAt };
    if (f.parentId === id) next.parentId = parentId;
    return next;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  const { getNotes, updateNote } = await import('./noteService');
  const notes = await getNotes();
  for (const note of notes) {
    if (note.folderId === id) await updateNote(note.id, { folderId: null });
  }
  return true;
}
