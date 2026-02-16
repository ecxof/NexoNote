/**
 * Electron main process.
 * Handles window creation and IPC for notes/folders/PDFs/settings storage.
 *
 * Storage: SQLite database in userData/nexonote/nexonote.db
 * On first run, legacy JSON files are migrated automatically.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const database = require('./database.cjs');

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;
const DATA_DIR = path.join(app.getPath('userData'), 'nexonote');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialise database before anything else
  database.init(DATA_DIR);

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  database.close();
});

// ─── Notes IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('notes:getAll', () => {
  return database.notesGetAll();
});

ipcMain.handle('notes:getById', (_, id) => {
  return database.notesGetById(id);
});

ipcMain.handle('notes:create', (_, folderId = null) => {
  return database.notesCreate(folderId);
});

ipcMain.handle('notes:update', (_, id, payload) => {
  return database.notesUpdate(id, payload);
});

ipcMain.handle('notes:delete', (_, id) => {
  return database.notesDelete(id);
});

// ─── Folders IPC ────────────────────────────────────────────────────────────

ipcMain.handle('folders:getAll', () => {
  return database.foldersGetAll();
});

ipcMain.handle('folders:create', (_, name, parentId = null) => {
  return database.foldersCreate(name, parentId);
});

ipcMain.handle('folders:update', (_, id, payload) => {
  return database.foldersUpdate(id, payload);
});

ipcMain.handle('folders:delete', (_, id) => {
  return database.foldersDelete(id);
});

// ─── PDFs IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('pdfs:getAll', () => {
  return database.pdfsGetAll();
});

ipcMain.handle('pdfs:getById', (_, id) => {
  return database.pdfsGetById(id);
});

ipcMain.handle('pdfs:add', (_, filePath, title, folderId = null) => {
  return database.pdfsAdd(filePath, title, folderId);
});

ipcMain.handle('pdfs:update', (_, id, payload) => {
  return database.pdfsUpdate(id, payload);
});

ipcMain.handle('pdfs:remove', (_, id) => {
  return database.pdfsRemove(id);
});

// ─── Settings IPC ───────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => {
  return database.settingsGet();
});

ipcMain.handle('settings:set', (_, settings) => {
  return database.settingsSet(settings);
});
