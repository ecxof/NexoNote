/**
 * Electron main process.
 * Handles window creation and IPC for notes/folders/PDFs/settings storage.
 *
 * Storage: SQLite database in userData/nexonote/nexonote.db
 * When USE_PYTHON_BACKEND=1, spawns a Python HTTP backend and uses it; otherwise uses Node + better-sqlite3.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const database = require('./database.cjs');

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;
const DATA_DIR = path.join(app.getPath('userData'), 'nexonote');
const USE_PYTHON_BACKEND = process.env.USE_PYTHON_BACKEND === '1' || process.env.NEXONOTE_USE_PYTHON_BACKEND === 'true';

let backendBaseUrl = null;
let pythonProcess = null;
let useNodeBackend = true;

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

function waitForHealth(baseUrl, timeoutMs = 10000) {
  const start = Date.now();
  const url = new URL(`${baseUrl}/health`);
  return new Promise((resolve) => {
    const tryReq = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tryReq, 200);
      });
      req.on('error', () => {
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tryReq, 200);
      });
      req.setTimeout(2000, () => { req.destroy(); });
    };
    tryReq();
  });
}

function startPythonBackend() {
  return new Promise((resolve) => {
    const port = process.env.NEXONOTE_BACKEND_PORT || '8765';
    const baseUrl = `http://127.0.0.1:${port}`;
    const projectRoot = path.join(__dirname, '..');
    const env = {
      ...process.env,
      NEXONOTE_DATA_DIR: DATA_DIR,
      NEXONOTE_BACKEND_PORT: port,
    };
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(
      pythonCmd,
      ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', port],
      { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    pythonProcess = child;
    child.on('error', () => {
      pythonProcess = null;
      resolve(null);
    });
    child.on('exit', (code) => {
      if (pythonProcess === child) pythonProcess = null;
      resolve(null);
    });
    child.stderr?.on('data', () => {});
    waitForHealth(baseUrl).then((ok) => {
      if (ok) {
        backendBaseUrl = baseUrl;
        resolve(baseUrl);
      } else {
        try { child.kill(); } catch (_) {}
        pythonProcess = null;
        resolve(null);
      }
    });
  });
}

function registerNodeBackend() {
  useNodeBackend = true;
  database.init(DATA_DIR);

  ipcMain.handle('notes:getAll', () => database.notesGetAll());
  ipcMain.handle('notes:getById', (_, id) => database.notesGetById(id));
  ipcMain.handle('notes:create', (_, folderId = null) => database.notesCreate(folderId));
  ipcMain.handle('notes:update', (_, id, payload) => database.notesUpdate(id, payload));
  ipcMain.handle('notes:delete', (_, id) => database.notesDelete(id));

  ipcMain.handle('folders:getAll', () => database.foldersGetAll());
  ipcMain.handle('folders:create', (_, name, parentId = null) => database.foldersCreate(name, parentId));
  ipcMain.handle('folders:update', (_, id, payload) => database.foldersUpdate(id, payload));
  ipcMain.handle('folders:delete', (_, id) => database.foldersDelete(id));

  ipcMain.handle('pdfs:getAll', () => database.pdfsGetAll());
  ipcMain.handle('pdfs:getById', (_, id) => database.pdfsGetById(id));
  ipcMain.handle('pdfs:add', (_, filePath, title, folderId = null) => database.pdfsAdd(filePath, title, folderId));
  ipcMain.handle('pdfs:update', (_, id, payload) => database.pdfsUpdate(id, payload));
  ipcMain.handle('pdfs:remove', (_, id) => database.pdfsRemove(id));

  ipcMain.handle('settings:get', () => database.settingsGet());
  ipcMain.handle('settings:set', (_, settings) => database.settingsSet(settings));

  ipcMain.handle('flashcards:getAll', (_, filters = {}) => database.flashcardsGetAll(filters || {}));
  ipcMain.handle('flashcards:getLibrary', () => database.flashcardsGetLibrary());
  ipcMain.handle('flashcards:getById', (_, id) => database.flashcardsGetById(id));
  ipcMain.handle('flashcards:create', (_, payload = {}) => database.flashcardsCreate(payload));
  ipcMain.handle('flashcards:update', (_, id, payload = {}) => database.flashcardsUpdate(id, payload));
  ipcMain.handle('flashcards:delete', (_, id) => database.flashcardsDelete(id));
  ipcMain.handle('flashcards:getDue', (_, filters = {}) => database.flashcardsGetDue(filters || {}));
  ipcMain.handle('flashcards:review', (_, id, rating, reviewedAt = null, reviewMeta = {}) =>
    database.flashcardsReview(id, rating, reviewedAt, reviewMeta || {}));
  ipcMain.handle('flashcards:getPerformanceAnalytics', (_, filters = {}) =>
    database.flashcardsGetPerformanceAnalytics(filters || {}));
}

app.whenReady().then(async () => {
  if (USE_PYTHON_BACKEND) {
    const url = await startPythonBackend();
    if (url) {
      useNodeBackend = false;
      ipcMain.handle('backend:getBaseUrl', () => url);
    } else {
      if (pythonProcess) {
        try { pythonProcess.kill(); } catch (_) {}
        pythonProcess = null;
      }
      registerNodeBackend();
      ipcMain.handle('backend:getBaseUrl', () => null);
    }
  } else {
    registerNodeBackend();
    ipcMain.handle('backend:getBaseUrl', () => null);
  }

  // Semantic linking: Python CLI (independent of data backend)
  ipcMain.handle('semantic-links:find', async (_, payload) => {
    const projectRoot = path.join(__dirname, '..');
    const pythonEnv = process.env.NEXONOTE_SEMANTIC_PYTHON;
    const input = JSON.stringify({
      target_content: payload.target_content ?? '',
      notes: payload.notes ?? [],
      threshold: payload.threshold ?? 0.25,
      max_results: payload.max_results ?? 50,
      top_keywords: payload.top_keywords ?? 8,
    });
    const opts = { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] };
    return new Promise((resolve) => {
      const run = (pythonCmd, args) => {
        const proc = spawn(pythonCmd, args, opts);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (chunk) => { stdout += chunk; });
        proc.stderr.on('data', (chunk) => { stderr += chunk; });
        proc.on('error', (err) => {
          if (err.code === 'ENOENT' && process.platform === 'win32' && pythonCmd === 'py') {
            run('python', ['-m', 'semantic_linking.cli']);
            return;
          }
          resolve({ error: err.message || 'Failed to run Python' });
        });
        proc.on('close', (code) => {
          try {
            const data = JSON.parse(stdout || '{}');
            if (data.error) resolve({ error: data.error });
            else resolve({ links: data.links ?? [] });
          } catch {
            resolve({ error: stderr || stdout || (code !== 0 ? `Exit ${code}` : 'Invalid response') });
          }
        });
        proc.stdin.write(input, () => proc.stdin.end());
      };
      if (pythonEnv) {
        run(pythonEnv, ['-m', 'semantic_linking.cli']);
      } else if (process.platform === 'win32') {
        run('py', ['-3.13', '-m', 'semantic_linking.cli']);
      } else {
        run('python3', ['-m', 'semantic_linking.cli']);
      }
    });
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (_) {}
    pythonProcess = null;
  }
  if (useNodeBackend) database.close();
});
