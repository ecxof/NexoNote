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

    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      source_note_id  TEXT REFERENCES notes(id) ON DELETE SET NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id                TEXT PRIMARY KEY,
      deck_id           TEXT REFERENCES flashcard_decks(id) ON DELETE CASCADE,
      note_id           TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      topic_id          TEXT,
      prompt_text       TEXT,
      back_text         TEXT,
      question_text     TEXT NOT NULL,
      answer_text       TEXT NOT NULL,
      correct_answer_bool INTEGER,
      correct_option_index INTEGER,
      explanation_text  TEXT,
      type              TEXT NOT NULL CHECK (type IN ('flip', 'mcq', 'true_false')),
      status            TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SAVED')),
      easiness_factor   REAL NOT NULL DEFAULT 2.5,
      interval_days     INTEGER NOT NULL DEFAULT 0,
      repetition_count  INTEGER NOT NULL DEFAULT 0,
      last_review_date  TEXT,
      next_review_date  TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcard_options (
      id            TEXT PRIMARY KEY,
      flashcard_id  TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
      option_text   TEXT NOT NULL,
      is_correct    INTEGER NOT NULL DEFAULT 0,
      option_order  INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_history (
      id                    TEXT PRIMARY KEY,
      flashcard_id          TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
      reviewed_at           TEXT NOT NULL,
      rating                INTEGER NOT NULL,
      previous_ef           REAL NOT NULL,
      previous_interval     INTEGER NOT NULL,
      previous_repetition   INTEGER NOT NULL,
      next_ef               REAL NOT NULL,
      next_interval         INTEGER NOT NULL,
      next_repetition       INTEGER NOT NULL,
      next_review_date      TEXT NOT NULL,
      result                TEXT,
      difficulty            TEXT,
      response_time_ms      INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_notes_folder    ON notes(folder_id);
    CREATE INDEX IF NOT EXISTS idx_pdfs_folder     ON pdfs(folder_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_note  ON note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_tag   ON note_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_flashcard_decks_note ON flashcard_decks(source_note_id);
    CREATE INDEX IF NOT EXISTS idx_flashcards_note ON flashcards(note_id);
    CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id);
    CREATE INDEX IF NOT EXISTS idx_flashcards_due  ON flashcards(next_review_date, status);
    CREATE INDEX IF NOT EXISTS idx_flashcards_type ON flashcards(type, status);
    CREATE INDEX IF NOT EXISTS idx_review_history_flashcard ON review_history(flashcard_id, reviewed_at);
  `);

  runFlashcardMigrations();
  // Schema version for future migrations
  db.pragma('user_version = 3');
}

function runFlashcardMigrations() {
  const hasColumn = (table, column) => {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some((r) => r.name === column);
  };
  const ensureColumn = (table, column, ddl) => {
    if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };

  ensureColumn('flashcards', 'deck_id', 'deck_id TEXT REFERENCES flashcard_decks(id) ON DELETE CASCADE');
  ensureColumn('flashcards', 'prompt_text', 'prompt_text TEXT');
  ensureColumn('flashcards', 'back_text', 'back_text TEXT');
  ensureColumn('flashcards', 'correct_answer_bool', 'correct_answer_bool INTEGER');
  ensureColumn('flashcards', 'correct_option_index', 'correct_option_index INTEGER');

  ensureColumn('review_history', 'result', 'result TEXT');
  ensureColumn('review_history', 'difficulty', 'difficulty TEXT');
  ensureColumn('review_history', 'response_time_ms', 'response_time_ms INTEGER');

  db.prepare('UPDATE flashcards SET prompt_text = question_text WHERE prompt_text IS NULL').run();
  db.prepare('UPDATE flashcards SET back_text = answer_text WHERE back_text IS NULL').run();

  // Backfill one deck per note for legacy rows.
  const rows = db.prepare('SELECT DISTINCT note_id FROM flashcards WHERE note_id IS NOT NULL').all();
  const findDeck = db.prepare('SELECT id FROM flashcard_decks WHERE source_note_id = ?');
  const noteRow = db.prepare('SELECT title FROM notes WHERE id = ?');
  const insertDeck = db.prepare(
    'INSERT INTO flashcard_decks (id, title, source_note_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  const setDeckOnCards = db.prepare('UPDATE flashcards SET deck_id = ? WHERE note_id = ? AND (deck_id IS NULL OR deck_id = "")');
  const now = new Date().toISOString();

  for (const row of rows) {
    if (!row.note_id) continue;
    const existing = findDeck.get(row.note_id);
    let deckId = existing?.id || null;
    if (!deckId) {
      const note = noteRow.get(row.note_id);
      deckId = crypto.randomUUID();
      insertDeck.run(deckId, note?.title || 'Untitled Deck', row.note_id, now, now);
    }
    setDeckOnCards.run(deckId, row.note_id);
  }
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

function normalizeFlashcardType(type) {
  if (type === 'mcq' || type === 'flip' || type === 'true_false') return type;
  if (type === 'MCQ') return 'mcq';
  if (type === 'Flip Cards' || type === 'Flip Card') return 'flip';
  if (type === 'True / False' || type === 'True/False') return 'true_false';
  return 'flip';
}

function normalizeDraftStatus(status) {
  return status === 'SAVED' ? 'SAVED' : 'DRAFT';
}

function flashcardOptionsGet(flashcardId) {
  return db.prepare(
    'SELECT id, option_text, is_correct, option_order FROM flashcard_options WHERE flashcard_id = ? ORDER BY option_order ASC, created_at ASC'
  ).all(flashcardId).map((row) => ({
    id: row.id,
    text: row.option_text,
    isCorrect: !!row.is_correct,
    order: row.option_order,
  }));
}

function flashcardToObj(row) {
  const correctIndex =
    row.correct_option_index !== undefined && row.correct_option_index !== null
      ? Number(row.correct_option_index)
      : null;
  const correctOption =
    row.type === 'mcq' && correctIndex != null
      ? flashcardOptionsGet(row.id)[correctIndex] || null
      : null;
  return {
    id: row.id,
    deckId: row.deck_id || null,
    deckTitle: row.deck_title || null,
    sourceNoteId: row.source_note_id || row.note_id || null,
    noteId: row.note_id,
    topicId: row.topic_id,
    prompt: row.prompt_text || row.question_text,
    back: row.back_text || row.answer_text,
    questionText: row.prompt_text || row.question_text,
    answerText: row.back_text || row.answer_text,
    correctAnswer: row.type === 'true_false'
      ? (row.correct_answer_bool == null ? null : !!row.correct_answer_bool)
      : null,
    correctOptionIndex: row.type === 'mcq' ? correctIndex : null,
    correctOptionText: row.type === 'mcq' ? (correctOption?.text || row.answer_text || null) : null,
    explanationText: row.explanation_text || '',
    type: row.type,
    status: row.status,
    easinessFactor: row.easiness_factor,
    intervalDays: row.interval_days,
    repetitionCount: row.repetition_count,
    lastReviewDate: row.last_review_date,
    nextReviewDate: row.next_review_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    options: row.type === 'mcq' ? flashcardOptionsGet(row.id) : [],
  };
}

function normalizeTfValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    if (t === 'true') return true;
    if (t === 'false') return false;
  }
  return null;
}

function ensureDeckForSourceNote(noteId, fallbackTitle = 'Untitled Deck') {
  const existing = db.prepare('SELECT * FROM flashcard_decks WHERE source_note_id = ?').get(noteId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO flashcard_decks (id, title, source_note_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, fallbackTitle, noteId, now, now);
  return db.prepare('SELECT * FROM flashcard_decks WHERE id = ?').get(id);
}

function decksGetAll() {
  const rows = db.prepare(
    `
      SELECT d.*, n.title AS source_note_title
      FROM flashcard_decks d
      LEFT JOIN notes n ON n.id = d.source_note_id
      ORDER BY datetime(d.updated_at) DESC
    `
  ).all();
  return rows.map((row) => ({
    id: row.id,
    title: row.source_note_id ? (row.source_note_title || row.title) : row.title,
    sourceNoteId: row.source_note_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function deckToObj(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    sourceNoteId: row.source_note_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function decksGetById(id) {
  const row = db.prepare('SELECT * FROM flashcard_decks WHERE id = ?').get(id);
  return deckToObj(row);
}

function decksCreate(title, sourceNoteId = null) {
  const now = new Date().toISOString();
  if (sourceNoteId) {
    const note = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(sourceNoteId);
    if (!note) throw new Error('Source note not found');
    const deck = ensureDeckForSourceNote(sourceNoteId, note.title || title || 'Untitled Deck');
    return deckToObj(deck);
  }
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO flashcard_decks (id, title, source_note_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)'
  ).run(id, title || 'Untitled Deck', now, now);
  return decksGetById(id);
}

function decksUpdate(id, payload = {}) {
  const row = db.prepare('SELECT * FROM flashcard_decks WHERE id = ?').get(id);
  if (!row) return null;
  const now = new Date().toISOString();
  const title = payload.title !== undefined ? String(payload.title || '').trim() : row.title;
  const sourceNoteId = payload.sourceNoteId !== undefined ? (payload.sourceNoteId || null) : row.source_note_id;

  let effectiveTitle = title;
  if (sourceNoteId) {
    const note = db.prepare('SELECT title FROM notes WHERE id = ?').get(sourceNoteId);
    if (note?.title) effectiveTitle = note.title;
  }

  db.prepare(
    'UPDATE flashcard_decks SET title = ?, source_note_id = ?, updated_at = ? WHERE id = ?'
  ).run(effectiveTitle || row.title, sourceNoteId, now, id);
  return decksGetById(id);
}

function decksDelete(id) {
  const info = db.prepare('DELETE FROM flashcard_decks WHERE id = ?').run(id);
  return info.changes > 0;
}

function ensureFutureISOString(baseIso, days) {
  const date = new Date(baseIso);
  if (Number.isFinite(days) && days > 0) {
    date.setUTCDate(date.getUTCDate() + days);
  }
  return date.toISOString();
}

function computeSm2State(current, rating, reviewedAtIso) {
  const previousEf = Number(current.easinessFactor ?? 2.5);
  const previousInterval = Number(current.intervalDays ?? 0);
  const previousRepetition = Number(current.repetitionCount ?? 0);

  const score = Number.isFinite(Number(rating)) ? Math.max(0, Math.min(5, Math.round(Number(rating)))) : 0;
  let repetition = previousRepetition;
  let interval = previousInterval;

  if (score < 3) {
    repetition = 0;
    interval = 1;
  } else {
    repetition += 1;
    if (repetition === 1) interval = 1;
    else if (repetition === 2) interval = 6;
    else interval = Math.round(Math.max(1, interval * previousEf));
  }

  let ef = previousEf + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
  if (ef < 1.3) ef = 1.3;
  ef = Number(ef.toFixed(4));

  const nextReviewDate = ensureFutureISOString(reviewedAtIso, interval);

  return {
    previousEf,
    previousInterval,
    previousRepetition,
    nextEf: ef,
    nextInterval: interval,
    nextRepetition: repetition,
    nextReviewDate,
    rating: score,
  };
}

function applyDifficultyScheduleOverride(sm2, reviewedAtIso, difficulty) {
  const level = String(difficulty || '').trim().toLowerCase();
  const next = { ...sm2 };
  const date = new Date(reviewedAtIso);
  if (level === 'again') {
    // Immediate reappearance in due queues.
    next.nextReviewDate = reviewedAtIso;
    return next;
  }
  if (level === 'hard') {
    date.setUTCHours(date.getUTCHours() + 3);
    next.nextReviewDate = date.toISOString();
    return next;
  }
  if (level === 'good') {
    date.setUTCDate(date.getUTCDate() + 1);
    next.nextReviewDate = date.toISOString();
    return next;
  }
  if (level === 'easy') {
    date.setUTCDate(date.getUTCDate() + 2);
    next.nextReviewDate = date.toISOString();
    return next;
  }
  return next;
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

  // Keep note-linked flashcard deck titles in sync with note title.
  db.prepare(
    'UPDATE flashcard_decks SET title = ?, updated_at = ? WHERE source_note_id = ?'
  ).run(title, now, id);

  // Sync tags if provided
  if (payload.tags !== undefined) {
    syncNoteTags(id, payload.tags);
  }

  return noteToObj({ ...row, title, content, folder_id: folder, updated_at: now });
}

function notesDelete(id) {
  const removeFlashcards = db.prepare('DELETE FROM flashcards WHERE note_id = ?');
  const removeNoteTags = db.prepare('DELETE FROM note_tags WHERE note_id = ?');
  const removeNote = db.prepare('DELETE FROM notes WHERE id = ?');
  const tx = db.transaction((noteId) => {
    removeFlashcards.run(noteId);
    removeNoteTags.run(noteId);
    return removeNote.run(noteId);
  });
  const info = tx(id);
  return info?.changes > 0;
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

// ─── Flashcards ─────────────────────────────────────────────────────────────────

function flashcardsGetAll({
  status = null,
  type = null,
  noteId = null,
  topicId = null,
  dueOnly = false,
  now = null,
} = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('f.status = ?');
    params.push(normalizeDraftStatus(status));
  }
  if (type) {
    conditions.push('f.type = ?');
    params.push(normalizeFlashcardType(type));
  }
  if (noteId) {
    conditions.push('f.note_id = ?');
    params.push(noteId);
  }
  if (topicId) {
    conditions.push("COALESCE(NULLIF(f.topic_id, ''), f.note_id) = ?");
    params.push(topicId);
  }
  if (dueOnly) {
    conditions.push("f.next_review_date IS NOT NULL AND datetime(f.next_review_date) <= datetime(?)");
    params.push(now || new Date().toISOString());
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(
    `
      SELECT f.*, n.title AS note_title
      FROM flashcards f
      LEFT JOIN notes n ON n.id = f.note_id
      ${where}
      ORDER BY datetime(f.updated_at) DESC
    `
  ).all(...params);
  return rows.map((row) => {
    const card = flashcardToObj(row);
    return {
      ...card,
      noteTitle: row.note_title || 'Untitled',
      deckTitle: row.note_title || 'Untitled',
      sourceNoteId: row.note_id || null,
    };
  });
}

function flashcardsGetById(id) {
  const row = db.prepare(
    `
      SELECT f.*, n.title AS note_title
      FROM flashcards f
      LEFT JOIN notes n ON n.id = f.note_id
      WHERE f.id = ?
    `
  ).get(id);
  if (!row) return null;
  const card = flashcardToObj(row);
  return {
    ...card,
    noteTitle: row.note_title || 'Untitled',
    deckTitle: row.note_title || 'Untitled',
    sourceNoteId: row.note_id || null,
  };
}

function flashcardsGetLibrary() {
  const rows = db.prepare(
    `
      SELECT
        n.id AS note_id,
        n.title AS note_title,
        COUNT(f.id) AS total_cards,
        SUM(
          CASE
            WHEN f.status = 'SAVED'
              AND f.next_review_date IS NOT NULL
              AND datetime(f.next_review_date) <= datetime('now')
            THEN 1
            ELSE 0
          END
        ) AS due_today
      FROM notes n
      JOIN flashcards f ON f.note_id = n.id
      GROUP BY n.id, n.title
      HAVING COUNT(f.id) > 0
      ORDER BY datetime(MAX(f.updated_at)) DESC
    `
  ).all();

  return rows.map((row) => ({
    noteId: row.note_id,
    title: row.note_title || 'Untitled',
    tags: getTagsForNote(row.note_id),
    totalCards: Number(row.total_cards) || 0,
    dueToday: Number(row.due_today) || 0,
  }));
}

function writeFlashcardOptions(flashcardId, options = []) {
  db.prepare('DELETE FROM flashcard_options WHERE flashcard_id = ?').run(flashcardId);
  if (!Array.isArray(options) || options.length === 0) return;
  const insert = db.prepare(
    'INSERT INTO flashcard_options (id, flashcard_id, option_text, is_correct, option_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const now = new Date().toISOString();
  options.forEach((opt, index) => {
    insert.run(
      crypto.randomUUID(),
      flashcardId,
      String(opt.text || '').trim(),
      opt.isCorrect ? 1 : 0,
      Number.isFinite(opt.order) ? opt.order : index,
      now
    );
  });
}

function flashcardsCreate(payload) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const type = normalizeFlashcardType(payload.type);
  const status = normalizeDraftStatus(payload.status);
  const ef = Number.isFinite(Number(payload.easinessFactor)) ? Number(payload.easinessFactor) : 2.5;
  const interval = Number.isFinite(Number(payload.intervalDays)) ? Number(payload.intervalDays) : 0;
  const repetition = Number.isFinite(Number(payload.repetitionCount)) ? Number(payload.repetitionCount) : 0;

  const noteLookupId = payload.noteId || payload.sourceNoteId || null;
  const note = noteLookupId
    ? db.prepare('SELECT id, title, folder_id FROM notes WHERE id = ?').get(noteLookupId)
    : null;
  const sourceNoteId = payload.sourceNoteId || payload.noteId || note?.id || null;
  if (!sourceNoteId) throw new Error('noteId is required for flashcards');

  const prompt = String(payload.prompt || payload.questionText || '').trim();
  const back = String(payload.back || payload.answerText || '').trim();
  const options = Array.isArray(payload.options) ? payload.options : [];
  const correctOptionIndex = type === 'mcq'
    ? (
      payload.correctOptionIndex != null
        ? Number(payload.correctOptionIndex)
        : options.findIndex((o) => !!o.isCorrect)
    )
    : null;
  const correctTf = type === 'true_false'
    ? normalizeTfValue(payload.correctAnswer ?? payload.answerText)
    : null;
  const normalizedOptions = type === 'mcq'
    ? options.map((opt, idx) => ({
      text: String(opt.text || '').trim(),
      isCorrect: idx === correctOptionIndex,
      order: Number.isFinite(Number(opt.order)) ? Number(opt.order) : idx,
    })).filter((opt) => opt.text.length > 0)
    : [];
  const nextReviewDate = payload.nextReviewDate || now;
  const answerText = type === 'mcq'
    ? (normalizedOptions[correctOptionIndex]?.text || back || '')
    : type === 'true_false'
      ? (correctTf ? 'True' : 'False')
      : back;

  db.prepare(
    `
      INSERT INTO flashcards (
        id, deck_id, note_id, topic_id, prompt_text, back_text, question_text, answer_text,
        correct_answer_bool, correct_option_index, explanation_text, type, status,
        easiness_factor, interval_days, repetition_count, last_review_date, next_review_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    null,
    sourceNoteId || note?.id || null,
    payload.topicId || note?.folder_id || null,
    prompt,
    back,
    prompt,
    answerText,
    correctTf == null ? null : (correctTf ? 1 : 0),
    type === 'mcq' ? correctOptionIndex : null,
    payload.explanation ? String(payload.explanation).trim() : (payload.explanationText ? String(payload.explanationText).trim() : null),
    type,
    status,
    ef,
    interval,
    repetition,
    payload.lastReviewDate || null,
    nextReviewDate,
    now,
    now
  );

  if (type === 'mcq') writeFlashcardOptions(id, normalizedOptions);
  return flashcardsGetById(id);
}

function flashcardsUpdate(id, payload) {
  const row = db.prepare('SELECT * FROM flashcards WHERE id = ?').get(id);
  if (!row) return null;

  const now = new Date().toISOString();
  const type = payload.type !== undefined ? normalizeFlashcardType(payload.type) : row.type;
  const existingOptions = row.type === 'mcq' ? flashcardOptionsGet(id) : [];
  const nextOptions = payload.options !== undefined
    ? (Array.isArray(payload.options) ? payload.options : [])
    : existingOptions;
  const correctOptionIndex = type === 'mcq'
    ? (
      payload.correctOptionIndex != null
        ? Number(payload.correctOptionIndex)
        : nextOptions.findIndex((o) => !!o.isCorrect)
    )
    : null;
  const normalizedOptions = type === 'mcq'
    ? nextOptions.map((opt, idx) => ({
      text: String(opt.text || '').trim(),
      isCorrect: idx === correctOptionIndex,
      order: Number.isFinite(Number(opt.order)) ? Number(opt.order) : idx,
    })).filter((opt) => opt.text.length > 0)
    : [];
  const correctTf = type === 'true_false'
    ? normalizeTfValue(payload.correctAnswer ?? payload.answerText ?? row.correct_answer_bool)
    : null;
  const prompt = payload.prompt !== undefined
    ? String(payload.prompt || '').trim()
    : payload.questionText !== undefined
      ? String(payload.questionText || '').trim()
      : (row.prompt_text || row.question_text);
  const back = payload.back !== undefined
    ? String(payload.back || '').trim()
    : payload.answerText !== undefined
      ? String(payload.answerText || '').trim()
      : (row.back_text || row.answer_text);
  const answerText = type === 'mcq'
    ? (normalizedOptions[correctOptionIndex]?.text || back || '')
    : type === 'true_false'
      ? (correctTf ? 'True' : 'False')
      : back;

  const next = {
    prompt_text: prompt,
    back_text: back,
    question_text: prompt,
    answer_text: answerText,
    explanation_text: payload.explanation !== undefined
      ? (payload.explanation ? String(payload.explanation).trim() : null)
      : payload.explanationText !== undefined
        ? (payload.explanationText ? String(payload.explanationText).trim() : null)
      : row.explanation_text,
    type,
    status: payload.status !== undefined ? normalizeDraftStatus(payload.status) : row.status,
    easiness_factor: payload.easinessFactor !== undefined ? Number(payload.easinessFactor) : row.easiness_factor,
    interval_days: payload.intervalDays !== undefined ? Number(payload.intervalDays) : row.interval_days,
    repetition_count: payload.repetitionCount !== undefined ? Number(payload.repetitionCount) : row.repetition_count,
    last_review_date: payload.lastReviewDate !== undefined ? payload.lastReviewDate : row.last_review_date,
    next_review_date: payload.nextReviewDate !== undefined ? payload.nextReviewDate : row.next_review_date,
    topic_id: payload.topicId !== undefined ? payload.topicId : row.topic_id,
    correct_answer_bool: type === 'true_false' ? (correctTf == null ? null : (correctTf ? 1 : 0)) : null,
    correct_option_index: type === 'mcq' ? correctOptionIndex : null,
  };

  db.prepare(
    `
      UPDATE flashcards
      SET prompt_text = ?, back_text = ?, question_text = ?, answer_text = ?, explanation_text = ?, type = ?, status = ?,
          easiness_factor = ?, interval_days = ?, repetition_count = ?, last_review_date = ?,
          next_review_date = ?, topic_id = ?, correct_answer_bool = ?, correct_option_index = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(
    next.prompt_text,
    next.back_text,
    next.question_text,
    next.answer_text,
    next.explanation_text,
    next.type,
    next.status,
    next.easiness_factor,
    next.interval_days,
    next.repetition_count,
    next.last_review_date,
    next.next_review_date,
    next.topic_id,
    next.correct_answer_bool,
    next.correct_option_index,
    now,
    id
  );

  if (next.type === 'mcq') writeFlashcardOptions(id, normalizedOptions);
  else db.prepare('DELETE FROM flashcard_options WHERE flashcard_id = ?').run(id);

  return flashcardsGetById(id);
}

function flashcardsDelete(id) {
  const info = db.prepare('DELETE FROM flashcards WHERE id = ?').run(id);
  return info.changes > 0;
}

function flashcardsGetDue({ noteId = null, topicId = null, type = null, now = null, limit = 100 } = {}) {
  const conditions = [
    "f.status = 'SAVED'",
    'f.next_review_date IS NOT NULL',
    'datetime(f.next_review_date) <= datetime(?)',
  ];
  const params = [now || new Date().toISOString()];

  if (noteId) {
    conditions.push('f.note_id = ?');
    params.push(noteId);
  }
  if (topicId) {
    conditions.push("COALESCE(NULLIF(f.topic_id, ''), f.note_id) = ?");
    params.push(topicId);
  }
  if (type) {
    conditions.push('f.type = ?');
    params.push(normalizeFlashcardType(type));
  }

  const rows = db.prepare(
    `
      SELECT f.*, n.title AS note_title
      FROM flashcards f
      LEFT JOIN notes n ON n.id = f.note_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY datetime(f.next_review_date) ASC, datetime(f.created_at) ASC
      LIMIT ?
    `
  ).all(...params, Number(limit) || 100);

  return rows.map((row) => {
    const card = flashcardToObj(row);
    return {
      ...card,
      deckTitle: row.note_title || 'Untitled',
      noteTitle: row.note_title || 'Untitled',
      sourceNoteId: row.note_id || null,
    };
  });
}

function flashcardsGetPerformanceAnalytics({ days = 30, now = null } = {}) {
  const endIso = now || new Date().toISOString();
  const start = new Date(endIso);
  start.setUTCDate(start.getUTCDate() - Math.max(1, Number(days) || 30));
  const startIso = start.toISOString();

  const rows = db.prepare(
    `
      WITH topic_base AS (
        SELECT DISTINCT
          COALESCE(NULLIF(f.topic_id, ''), f.note_id) AS topic_key,
          COALESCE(fd.name, n.title, 'Untitled Topic') AS topic_name
        FROM flashcards f
        LEFT JOIN notes n ON n.id = f.note_id
        LEFT JOIN folders fd ON fd.id = f.topic_id
        WHERE f.status = 'SAVED'
      ),
      review_base AS (
        SELECT
          COALESCE(NULLIF(f.topic_id, ''), f.note_id) AS topic_key,
          COUNT(rh.id) AS total_reviews,
          SUM(
            CASE
              WHEN lower(COALESCE(rh.result, '')) = 'correct' THEN 1
              ELSE 0
            END
          ) AS correct_reviews
        FROM review_history rh
        JOIN flashcards f ON f.id = rh.flashcard_id
        WHERE datetime(rh.reviewed_at) >= datetime(?)
          AND datetime(rh.reviewed_at) <= datetime(?)
        GROUP BY topic_key
      )
      SELECT
        tb.topic_key,
        tb.topic_name,
        COALESCE(rb.total_reviews, 0) AS total_reviews,
        COALESCE(rb.correct_reviews, 0) AS correct_reviews
      FROM topic_base tb
      LEFT JOIN review_base rb ON rb.topic_key = tb.topic_key
      ORDER BY tb.topic_name COLLATE NOCASE ASC
    `
  ).all(startIso, endIso);

  const topics = rows.map((row) => {
    const totalReviews = Number(row.total_reviews) || 0;
    const correctReviews = Number(row.correct_reviews) || 0;
    const masteryPercent = totalReviews > 0
      ? Number(((correctReviews / totalReviews) * 100).toFixed(1))
      : 0;
    const category = totalReviews === 0
      ? 'No Data'
      : masteryPercent >= 80
        ? 'Mastery'
        : masteryPercent >= 60
          ? 'Review Needed'
          : 'Critical';
    return {
      topicId: row.topic_key,
      topicName: row.topic_name || 'Untitled Topic',
      totalReviews,
      correctReviews,
      masteryPercent,
      category,
      noData: totalReviews === 0,
    };
  });

  const weakTopics = topics
    .filter((t) => t.masteryPercent < 60 && t.totalReviews >= 3)
    .sort((a, b) => a.masteryPercent - b.masteryPercent || b.totalReviews - a.totalReviews);

  return {
    windowDays: Math.max(1, Number(days) || 30),
    startDate: startIso,
    endDate: endIso,
    topics,
    weakTopics,
  };
}

function flashcardsReview(id, rating, reviewedAt = null, reviewMeta = {}) {
  const row = db.prepare('SELECT * FROM flashcards WHERE id = ?').get(id);
  if (!row) throw new Error('Flashcard not found');

  const reviewedAtIso = reviewedAt || new Date().toISOString();
  const sm2Base = computeSm2State(
    {
      easinessFactor: row.easiness_factor,
      intervalDays: row.interval_days,
      repetitionCount: row.repetition_count,
    },
    rating,
    reviewedAtIso
  );
  const sm2 = applyDifficultyScheduleOverride(sm2Base, reviewedAtIso, reviewMeta.difficulty);

  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE flashcards
        SET easiness_factor = ?, interval_days = ?, repetition_count = ?, last_review_date = ?,
            next_review_date = ?, status = 'SAVED', updated_at = ?
        WHERE id = ?
      `
    ).run(
      sm2.nextEf,
      sm2.nextInterval,
      sm2.nextRepetition,
      reviewedAtIso,
      sm2.nextReviewDate,
      reviewedAtIso,
      id
    );

    db.prepare(
      `
        INSERT INTO review_history (
          id, flashcard_id, reviewed_at, rating,
          previous_ef, previous_interval, previous_repetition,
          next_ef, next_interval, next_repetition, next_review_date, result, difficulty, response_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      crypto.randomUUID(),
      id,
      reviewedAtIso,
      sm2.rating,
      sm2.previousEf,
      sm2.previousInterval,
      sm2.previousRepetition,
      sm2.nextEf,
      sm2.nextInterval,
      sm2.nextRepetition,
      sm2.nextReviewDate,
      reviewMeta.result || null,
      reviewMeta.difficulty || null,
      Number.isFinite(Number(reviewMeta.responseTimeMs)) ? Number(reviewMeta.responseTimeMs) : null
    );
  });

  tx();

  return {
    flashcard: flashcardsGetById(id),
    scheduling: sm2,
  };
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

  decksGetAll,
  decksGetById,
  decksCreate,
  decksUpdate,
  decksDelete,

  flashcardsGetAll,
  flashcardsGetLibrary,
  flashcardsGetById,
  flashcardsCreate,
  flashcardsUpdate,
  flashcardsDelete,
  flashcardsGetDue,
  flashcardsReview,
  flashcardsGetPerformanceAnalytics,

  settingsGet,
  settingsSet,
};
