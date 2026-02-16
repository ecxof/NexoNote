/**
 * SQLite database layer for NexoNote.
 *
 * Provides initialisation (schema + migration from legacy JSON files)
 * and all query helpers consumed by the IPC handlers in main.cjs.
 *
 * Uses better-sqlite3 (synchronous, single-writer – perfect for Electron).
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ─── Initialisation ────────────────────────────────────────────────────────

let db = null;

/**
 * Open (or create) the database and run schema + migration.
 * Call once at app startup, before any IPC handler fires.
 * @param {string} dataDir – e.g. path.join(app.getPath('userData'), 'nexonote')
 */
function init(dataDir) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'nexonote.db');
  db = new Database(dbPath);

  // Recommended pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema();
  migrateFromJson(dataDir);
}

/** Create tables if they don't already exist. */
function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'New Folder',
      parent_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'Untitled',
      content     TEXT NOT NULL DEFAULT '',
      folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS pdfs (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'Untitled PDF',
      file_path   TEXT NOT NULL,
      folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_folder    ON notes(folder_id);
    CREATE INDEX IF NOT EXISTS idx_pdfs_folder     ON pdfs(folder_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_note  ON note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_tag   ON note_tags(tag_id);
  `);

  // Schema version for future migrations
  db.pragma('user_version = 1');
}

// ─── Legacy JSON Migration ─────────────────────────────────────────────────

function migrateFromJson(dataDir) {
  const notesFile    = path.join(dataDir, 'notes.json');
  const foldersFile  = path.join(dataDir, 'folders.json');
  const settingsFile = path.join(dataDir, 'settings.json');

  const hasNotes    = fs.existsSync(notesFile);
  const hasFolders  = fs.existsSync(foldersFile);
  const hasSettings = fs.existsSync(settingsFile);

  if (!hasNotes && !hasFolders && !hasSettings) return; // nothing to migrate

  const migrate = db.transaction(() => {
    // --- Folders ---
    if (hasFolders) {
      const folders = JSON.parse(fs.readFileSync(foldersFile, 'utf8'));
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)'
      );
      for (const f of folders) {
        stmt.run(f.id, f.name || 'New Folder', f.parentId || null, f.createdAt || new Date().toISOString());
      }
    }

    // --- Notes (+ inline tags) ---
    if (hasNotes) {
      const notes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
      const noteStmt = db.prepare(
        'INSERT OR IGNORE INTO notes (id, title, content, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const getTag  = db.prepare('SELECT id FROM tags WHERE name = ?');
      const addTag  = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const linkTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');

      for (const n of notes) {
        const now = new Date().toISOString();
        noteStmt.run(
          n.id,
          n.title || 'Untitled',
          n.content || '',
          n.folderId || null,
          n.createdAt || now,
          n.updatedAt || now
        );

        // Migrate inline tags
        if (Array.isArray(n.tags)) {
          for (const tagName of n.tags) {
            if (!tagName) continue;
            addTag.run(tagName);
            const tagRow = getTag.get(tagName);
            if (tagRow) linkTag.run(n.id, tagRow.id);
          }
        }
      }
    }

    // --- Settings ---
    if (hasSettings) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [key, val] of Object.entries(settings)) {
        stmt.run(key, JSON.stringify(val));
      }
    }
  });

  try {
    migrate();

    // Rename JSON files to .bak so migration won't re-run
    if (hasNotes)    fs.renameSync(notesFile,    notesFile    + '.bak');
    if (hasFolders)  fs.renameSync(foldersFile,  foldersFile  + '.bak');
    if (hasSettings) fs.renameSync(settingsFile, settingsFile + '.bak');

    console.log('[database] Migrated legacy JSON files to SQLite.');
  } catch (err) {
    console.error('[database] Migration failed – JSON files left untouched.', err);
  }
}

// ─── Helper: get tags array for a note ─────────────────────────────────────

function getTagsForNote(noteId) {
  const rows = db.prepare(
    'SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ?'
  ).all(noteId);
  return rows.map((r) => r.name);
}

/** Sync a note's tags: remove old links, add new ones. */
function syncNoteTags(noteId, tags) {
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);
  if (!Array.isArray(tags) || tags.length === 0) return;

  const addTag  = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag  = db.prepare('SELECT id FROM tags WHERE name = ?');
  const linkTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');

  for (const name of tags) {
    if (!name) continue;
    addTag.run(name);
    const row = getTag.get(name);
    if (row) linkTag.run(noteId, row.id);
  }
}

/** Convert a raw notes row to the shape the renderer expects. */
function noteToObj(row) {
  return {
    id:        row.id,
    title:     row.title,
    content:   row.content,
    folderId:  row.folder_id,
    tags:      getTagsForNote(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Convert a raw folders row. */
function folderToObj(row) {
  return {
    id:        row.id,
    name:      row.name,
    parentId:  row.parent_id,
    createdAt: row.created_at,
  };
}

/** Convert a raw pdfs row. */
function pdfToObj(row) {
  return {
    id:        row.id,
    type:      'pdf',
    title:     row.title,
    filePath:  row.file_path,
    folderId:  row.folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Notes CRUD ─────────────────────────────────────────────────────────────

function notesGetAll() {
  const rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
  return rows.map(noteToObj);
}

function notesGetById(id) {
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  return row ? noteToObj(row) : null;
}

function notesCreate(folderId = null) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO notes (id, title, content, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, 'Untitled', '', folderId || null, now, now);
  return { id, title: 'Untitled', content: '', folderId: folderId || null, tags: [], createdAt: now, updatedAt: now };
}

function notesUpdate(id, payload) {
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!row) return null;

  const now = new Date().toISOString();
  const title   = payload.title   !== undefined ? payload.title   : row.title;
  const content = payload.content !== undefined ? payload.content : row.content;
  const folder  = payload.folderId !== undefined ? (payload.folderId || null) : row.folder_id;

  db.prepare(
    'UPDATE notes SET title = ?, content = ?, folder_id = ?, updated_at = ? WHERE id = ?'
  ).run(title, content, folder, now, id);

  // Sync tags if provided
  if (payload.tags !== undefined) {
    syncNoteTags(id, payload.tags);
  }

  return noteToObj({ ...row, title, content, folder_id: folder, updated_at: now });
}

function notesDelete(id) {
  const info = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── Folders CRUD ───────────────────────────────────────────────────────────

function foldersGetAll() {
  const rows = db.prepare('SELECT * FROM folders ORDER BY created_at ASC').all();
  return rows.map(folderToObj);
}

function foldersCreate(name, parentId = null) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, name || 'New Folder', parentId || null, now);
  return { id, name: name || 'New Folder', parentId: parentId || null, createdAt: now };
}

function foldersUpdate(id, payload) {
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
  if (!row) return null;

  const name     = payload.name     !== undefined ? payload.name     : row.name;
  const parentId = payload.parentId !== undefined ? (payload.parentId || null) : row.parent_id;

  db.prepare('UPDATE folders SET name = ?, parent_id = ? WHERE id = ?').run(name, parentId, id);
  return { id, name, parentId, createdAt: row.created_at };
}

function foldersDelete(id) {
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
  if (!row) return false;

  const parentId = row.parent_id || null;

  // Re-parent child folders to deleted folder's parent
  db.prepare('UPDATE folders SET parent_id = ? WHERE parent_id = ?').run(parentId, id);

  // Move notes in this folder to "All Notes" (folder_id = null)
  db.prepare('UPDATE notes SET folder_id = NULL WHERE folder_id = ?').run(id);

  // Move PDFs in this folder to "All" (folder_id = null)
  db.prepare('UPDATE pdfs SET folder_id = NULL WHERE folder_id = ?').run(id);

  // Delete the folder itself
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  return true;
}

// ─── PDFs CRUD ──────────────────────────────────────────────────────────────

function pdfsGetAll() {
  const rows = db.prepare('SELECT * FROM pdfs ORDER BY updated_at DESC').all();
  return rows.map(pdfToObj);
}

function pdfsGetById(id) {
  const row = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(id);
  return row ? pdfToObj(row) : null;
}

function pdfsAdd(filePath, title, folderId = null) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO pdfs (id, title, file_path, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, title || 'Untitled PDF', filePath, folderId || null, now, now);
  return { id, type: 'pdf', title: title || 'Untitled PDF', filePath, folderId: folderId || null, createdAt: now, updatedAt: now };
}

function pdfsUpdate(id, payload) {
  const row = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(id);
  if (!row) return null;

  const now      = new Date().toISOString();
  const title    = payload.title    !== undefined ? payload.title    : row.title;
  const folderId = payload.folderId !== undefined ? (payload.folderId || null) : row.folder_id;

  db.prepare('UPDATE pdfs SET title = ?, folder_id = ?, updated_at = ? WHERE id = ?').run(title, folderId, now, id);
  return pdfToObj({ ...row, title, folder_id: folderId, updated_at: now });
}

function pdfsRemove(id) {
  const info = db.prepare('DELETE FROM pdfs WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── Settings ───────────────────────────────────────────────────────────────

function settingsGet() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const result = {};
  for (const r of rows) {
    try { result[r.key] = JSON.parse(r.value); }
    catch { result[r.key] = r.value; }
  }
  return result;
}

function settingsSet(partial) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const upsert = db.transaction((entries) => {
    for (const [key, val] of entries) {
      stmt.run(key, JSON.stringify(val));
    }
  });
  upsert(Object.entries(partial));
  return settingsGet();
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

function close() {
  if (db) db.close();
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  init,
  close,

  notesGetAll,
  notesGetById,
  notesCreate,
  notesUpdate,
  notesDelete,

  foldersGetAll,
  foldersCreate,
  foldersUpdate,
  foldersDelete,

  pdfsGetAll,
  pdfsGetById,
  pdfsAdd,
  pdfsUpdate,
  pdfsRemove,

  settingsGet,
  settingsSet,
};
