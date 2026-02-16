/**
 * PDF service: CRUD for PDF metadata and file handling.
 * Uses Electron IPC when available (file-backed storage), otherwise localStorage (browser/dev).
 * PDF shape: { id, type: 'pdf', title, filePath, folderId?, createdAt, updatedAt }
 */

import { nanoid } from 'nanoid';

const STORAGE_KEY = 'nexonote_pdfs';

function hasElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.pdfs;
}

function toPdf(raw) {
  return {
    id: raw.id,
    type: 'pdf',
    title: raw.title ?? 'Untitled PDF',
    filePath: raw.filePath ?? '',
    folderId: raw.folderId ?? null,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt),
  };
}

function serializePdf(p) {
  return {
    id: p.id,
    type: 'pdf',
    title: p.title,
    filePath: p.filePath,
    folderId: p.folderId ?? null,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt?.toISOString?.() ?? p.createdAt,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.updatedAt?.toISOString?.() ?? p.updatedAt,
  };
}

/** @returns {Promise<Pdf[]>} */
export async function getPdfs() {
  if (hasElectron()) {
    const list = await window.electronAPI.pdfs.getAll();
    return list.map(toPdf);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.map(toPdf);
  } catch {
    return [];
  }
}

/** @returns {Promise<Pdf | null>} */
export async function getPdfById(id) {
  if (hasElectron()) {
    const raw = await window.electronAPI.pdfs.getById(id);
    return raw ? toPdf(raw) : null;
  }
  const list = await getPdfs();
  const raw = list.find((p) => p.id === id);
  return raw ? toPdf({ ...raw, createdAt: raw.createdAt.toISOString(), updatedAt: raw.updatedAt.toISOString() }) : null;
}

/**
 * Add a PDF (from import flow).
 * @param {string} filePath - Path to PDF file (or blob URL in browser)
 * @param {string} title - Display title (usually from filename)
 * @param {string | null} [folderId] - Optional folder ID
 * @returns {Promise<Pdf>}
 */
export async function addPdf(filePath, title, folderId = null) {
  if (hasElectron()) {
    const raw = await window.electronAPI.pdfs.add(filePath, title, folderId);
    return toPdf(raw);
  }
  const now = new Date().toISOString();
  const pdf = {
    id: nanoid(),
    type: 'pdf',
    title: title || 'Untitled PDF',
    filePath,
    folderId: folderId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const list = await getPdfs();
  list.unshift(pdf);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.map(serializePdf)));
  return toPdf(pdf);
}

/**
 * @param {string} id
 * @param {{ title?: string, folderId?: string | null }} payload
 * @returns {Promise<Pdf | null>}
 */
export async function updatePdf(id, payload) {
  if (hasElectron()) {
    const raw = await window.electronAPI.pdfs.update(id, payload);
    return raw ? toPdf(raw) : null;
  }
  const list = await getPdfs();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const updated = {
    ...list[index],
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  const toStore = list.map((p, i) => serializePdf(i === index ? updated : p));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  return toPdf(updated);
}

/**
 * Duplicate a PDF (copy). Creates a new entry with the same file data.
 * @param {string} id - Source PDF id
 * @param {string | null} [folderId] - Target folder (defaults to source folder)
 * @returns {Promise<Pdf>}
 */
export async function duplicatePdf(id, folderId) {
  const source = await getPdfById(id);
  if (!source) throw new Error('PDF not found');
  const targetFolder = folderId !== undefined ? folderId : source.folderId;
  return addPdf(source.filePath, `${source.title} (copy)`, targetFolder);
}

/** @returns {Promise<boolean>} */
export async function removePdf(id) {
  if (hasElectron()) {
    return window.electronAPI.pdfs.remove(id);
  }
  const list = await getPdfs();
  const filtered = list.filter((p) => p.id !== id);
  if (filtered.length === list.length) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.map(serializePdf)));
  return true;
}

/** @param {string | null | undefined} folderId - null/undefined = all PDFs */
/** @returns {Promise<Pdf[]>} */
export async function getPdfsByFolderId(folderId) {
  const all = await getPdfs();
  if (folderId === null || folderId === undefined) return all;
  return all.filter((p) => p.folderId === folderId);
}
