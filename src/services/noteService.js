/**
 * Note service: single abstraction for all note CRUD.
 * Uses Python backend HTTP when getBackendUrl() is set, else Electron IPC, else localStorage (browser/dev).
 * All methods return/accept the canonical Note shape: { id, title, content, createdAt, updatedAt }.
 */

import { nanoid } from 'nanoid';
import { getBackendClient } from '../apiClient';

const STORAGE_KEY = 'nexonote_notes';
const FLASHCARDS_KEY = 'nexonote_flashcards_v2_cards';

function hasElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.notes;
}

function toNote(raw) {
  return {
    id: raw.id,
    title: raw.title ?? 'Untitled',
    content: raw.content ?? '',
    folderId: raw.folderId ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt),
  };
}

/** @returns {Promise<Note[]>} */
export async function getNotes() {
  const backend = await getBackendClient();
  if (backend) {
    const list = await backend.notes.getAll();
    return list.map(toNote);
  }
  if (hasElectron()) {
    const list = await window.electronAPI.notes.getAll();
    return list.map(toNote);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.map(toNote);
  } catch {
    return [];
  }
}

/** @returns {Promise<Note | null>} */
export async function getNoteById(id) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.notes.getById(id);
    return raw ? toNote(raw) : null;
  }
  if (hasElectron()) {
    const raw = await window.electronAPI.notes.getById(id);
    return raw ? toNote(raw) : null;
  }
  const list = await getNotes();
  const raw = list.find((n) => n.id === id);
  return raw ? toNote({ ...raw, createdAt: raw.createdAt.toISOString(), updatedAt: raw.updatedAt.toISOString() }) : null;
}

/** @param {string | null} [folderId] */
/** @returns {Promise<Note>} */
export async function createNote(folderId = null) {
  const safeFolderId = folderId != null && typeof folderId === 'string' ? folderId : null;
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.notes.create(safeFolderId);
    return toNote(raw);
  }
  if (hasElectron()) {
    const raw = await window.electronAPI.notes.create(safeFolderId);
    return toNote(raw);
  }
  const now = new Date().toISOString();
  const note = {
    id: nanoid(),
    title: 'Untitled',
    content: '',
    folderId: safeFolderId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const list = await getNotes();
  list.unshift(note);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.map(serializeNote)));
  return toNote(note);
}

function serializeNote(n) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    folderId: n.folderId ?? null,
    tags: Array.isArray(n.tags) ? n.tags : [],
    createdAt: typeof n.createdAt === 'string' ? n.createdAt : n.createdAt?.toISOString?.() ?? n.createdAt,
    updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : n.updatedAt?.toISOString?.() ?? n.updatedAt,
  };
}


/**
 * @param {string} id
 * @param {{ title?: string, content?: string, tags?: string[] }} payload
 * @returns {Promise<Note | null>}
 */
export async function updateNote(id, payload) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.notes.update(id, payload);
    return raw ? toNote(raw) : null;
  }
  if (hasElectron()) {
    const raw = await window.electronAPI.notes.update(id, payload);
    return raw ? toNote(raw) : null;
  }
  const list = await getNotes();
  const index = list.findIndex((n) => n.id === id);
  if (index === -1) return null;
  const updated = {
    ...list[index],
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  const toStore = list.map((n, i) => serializeNote(i === index ? updated : n));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  return toNote(updated);
}

/** @returns {Promise<boolean>} */
export async function deleteNote(id) {
  const backend = await getBackendClient();
  if (backend) {
    return backend.notes.delete(id);
  }
  if (hasElectron()) {
    return window.electronAPI.notes.delete(id);
  }
  const list = await getNotes();
  const filtered = list.filter((n) => n.id !== id);
  if (filtered.length === list.length) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.map(serializeNote)));
  try {
    const rawCards = localStorage.getItem(FLASHCARDS_KEY);
    if (rawCards) {
      const cards = JSON.parse(rawCards);
      const nextCards = Array.isArray(cards)
        ? cards.filter((c) => c?.noteId !== id && c?.sourceNoteId !== id)
        : [];
      localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(nextCards));
    }
  } catch {
    // ignore local cleanup errors
  }
  return true;
}

/** @param {string | null | undefined} folderId - null/undefined = all notes */
/** @returns {Promise<Note[]>} */
export async function getNotesByFolderId(folderId) {
  const all = await getNotes();
  if (folderId === null || folderId === undefined) return all;
  return all.filter((n) => n.folderId === folderId);
}

/** Duplicate a note (same title + content) into optional folder. @returns {Promise<Note>} */
export async function duplicateNote(noteId, folderId = null) {
  const source = await getNoteById(noteId);
  if (!source) throw new Error('Note not found');
  const created = await createNote(folderId ?? source.folderId);
  const updated = await updateNote(created.id, { title: source.title + ' (copy)', content: source.content });
  return updated ?? created;
}
