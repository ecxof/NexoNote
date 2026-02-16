/**
 * Quick smoke-test for the SQLite database layer.
 * Run with: node electron/test-database.cjs
 *
 * Tests: schema creation, all CRUD, folder cascade, tag sync, settings,
 * and JSON migration. Uses a temp directory so it won't affect real data.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const database = require('./database.cjs');

const tmpDir = path.join(os.tmpdir(), 'nexonote-test-' + Date.now());
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}`);
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

try {
  // ── Init ──────────────────────────────────────────────────────────────────
  section('Initialisation');
  database.init(tmpDir);
  assert(fs.existsSync(path.join(tmpDir, 'nexonote.db')), 'Database file created');

  // ── Folders CRUD ──────────────────────────────────────────────────────────
  section('Folders CRUD');
  const f1 = database.foldersCreate('Work', null);
  assert(f1.name === 'Work' && f1.parentId === null, 'Create root folder');

  const f2 = database.foldersCreate('Projects', f1.id);
  assert(f2.parentId === f1.id, 'Create subfolder');

  const allFolders = database.foldersGetAll();
  assert(allFolders.length === 2, 'Get all folders');

  const updated = database.foldersUpdate(f1.id, { name: 'Work Stuff' });
  assert(updated.name === 'Work Stuff', 'Rename folder');

  // ── Notes CRUD ────────────────────────────────────────────────────────────
  section('Notes CRUD');
  const n1 = database.notesCreate(f1.id);
  assert(n1.title === 'Untitled' && n1.folderId === f1.id, 'Create note in folder');
  assert(Array.isArray(n1.tags) && n1.tags.length === 0, 'New note has empty tags');

  const n2 = database.notesCreate(null);
  assert(n2.folderId === null, 'Create uncategorized note');

  const updatedNote = database.notesUpdate(n1.id, { title: 'Meeting Notes', content: '<p>Hello</p>' });
  assert(updatedNote.title === 'Meeting Notes', 'Update note title');
  assert(updatedNote.content === '<p>Hello</p>', 'Update note content');

  const fetched = database.notesGetById(n1.id);
  assert(fetched && fetched.title === 'Meeting Notes', 'Get note by ID');

  const allNotes = database.notesGetAll();
  assert(allNotes.length === 2, 'Get all notes');

  // ── Tags ──────────────────────────────────────────────────────────────────
  section('Tags');
  database.notesUpdate(n1.id, { tags: ['work', 'meeting', 'important'] });
  const withTags = database.notesGetById(n1.id);
  assert(withTags.tags.length === 3, 'Set 3 tags on note');
  assert(withTags.tags.includes('work') && withTags.tags.includes('meeting'), 'Tags contain expected values');

  database.notesUpdate(n1.id, { tags: ['work'] });
  const reducedTags = database.notesGetById(n1.id);
  assert(reducedTags.tags.length === 1 && reducedTags.tags[0] === 'work', 'Reduce to 1 tag');

  database.notesUpdate(n1.id, { tags: [] });
  const noTags = database.notesGetById(n1.id);
  assert(noTags.tags.length === 0, 'Clear all tags');

  // ── PDFs CRUD ─────────────────────────────────────────────────────────────
  section('PDFs CRUD');
  const p1 = database.pdfsAdd('/path/to/doc.pdf', 'Report 2026', f1.id);
  assert(p1.type === 'pdf' && p1.title === 'Report 2026', 'Add PDF');

  const p2 = database.pdfsAdd('data:application/pdf;base64,abc', 'Data URL PDF', null);
  assert(p2.filePath === 'data:application/pdf;base64,abc', 'Add PDF with data URL');

  const allPdfs = database.pdfsGetAll();
  assert(allPdfs.length === 2, 'Get all PDFs');

  const updatedPdf = database.pdfsUpdate(p1.id, { title: 'Annual Report' });
  assert(updatedPdf.title === 'Annual Report', 'Rename PDF');

  const movedPdf = database.pdfsUpdate(p1.id, { folderId: f2.id });
  assert(movedPdf.folderId === f2.id, 'Move PDF to subfolder');

  const removedPdf = database.pdfsRemove(p2.id);
  assert(removedPdf === true, 'Remove PDF');
  assert(database.pdfsGetAll().length === 1, 'PDF count after removal');

  // ── Folder delete cascade ─────────────────────────────────────────────────
  section('Folder delete cascade');
  const n3 = database.notesCreate(f2.id);
  database.pdfsUpdate(p1.id, { folderId: f2.id });

  database.foldersDelete(f1.id);

  const f2After = database.foldersGetAll().find((f) => f.id === f2.id);
  assert(f2After && f2After.parentId === null, 'Subfolder re-parented to root');

  const n1After = database.notesGetById(n1.id);
  assert(n1After && n1After.folderId === null, 'Note moved to All Notes');

  // ── Note delete cascades tags ─────────────────────────────────────────────
  section('Note delete cascades tags');
  database.notesUpdate(n3.id, { tags: ['test-tag'] });
  database.notesDelete(n3.id);
  assert(database.notesGetById(n3.id) === null, 'Note deleted');

  // ── Settings ──────────────────────────────────────────────────────────────
  section('Settings');
  database.settingsSet({ autoSave: true, fontSize: 'medium', theme: 'dark' });
  const s = database.settingsGet();
  assert(s.autoSave === true, 'Boolean setting');
  assert(s.fontSize === 'medium', 'String setting');

  database.settingsSet({ theme: 'light', newKey: 42 });
  const s2 = database.settingsGet();
  assert(s2.theme === 'light', 'Updated setting');
  assert(s2.newKey === 42, 'New setting added');
  assert(s2.autoSave === true, 'Existing setting preserved');

  // ── JSON Migration ────────────────────────────────────────────────────────
  section('JSON Migration');
  database.close();

  const migrateDir = path.join(os.tmpdir(), 'nexonote-migrate-test-' + Date.now());
  fs.mkdirSync(migrateDir, { recursive: true });

  fs.writeFileSync(path.join(migrateDir, 'folders.json'), JSON.stringify([
    { id: 'f-old-1', name: 'Old Folder', parentId: null, createdAt: '2025-01-01T00:00:00.000Z' },
  ]));
  fs.writeFileSync(path.join(migrateDir, 'notes.json'), JSON.stringify([
    { id: 'n-old-1', title: 'Old Note', content: '<p>test</p>', folderId: 'f-old-1', tags: ['legacy', 'imported'], createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-06-01T00:00:00.000Z' },
  ]));
  fs.writeFileSync(path.join(migrateDir, 'settings.json'), JSON.stringify({
    autoSave: false, theme: 'light',
  }));

  // Re-init with migration dir
  database.init(migrateDir);

  const migratedFolders = database.foldersGetAll();
  assert(migratedFolders.some((f) => f.id === 'f-old-1'), 'Migrated folder exists');

  const migratedNote = database.notesGetById('n-old-1');
  assert(migratedNote !== null, 'Migrated note exists');
  assert(migratedNote.tags.includes('legacy') && migratedNote.tags.includes('imported'), 'Migrated tags preserved');

  const migratedSettings = database.settingsGet();
  assert(migratedSettings.theme === 'light', 'Migrated settings preserved');

  assert(fs.existsSync(path.join(migrateDir, 'notes.json.bak')), 'notes.json renamed to .bak');
  assert(fs.existsSync(path.join(migrateDir, 'folders.json.bak')), 'folders.json renamed to .bak');
  assert(fs.existsSync(path.join(migrateDir, 'settings.json.bak')), 'settings.json renamed to .bak');
  assert(!fs.existsSync(path.join(migrateDir, 'notes.json')), 'Original notes.json removed');

  database.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n========================================`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(migrateDir, { recursive: true, force: true });

  process.exit(failed > 0 ? 1 : 0);

} catch (err) {
  console.error('\n[FATAL]', err);
  database.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}
