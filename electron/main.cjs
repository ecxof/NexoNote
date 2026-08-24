/**
 * Electron main process.
 * Handles window creation and IPC for notes/folders/PDFs/settings storage.
 *
 * Storage: SQLite database in userData/nexonote/nexonote.db
 * When USE_PYTHON_BACKEND=1, spawns a Python HTTP backend and uses it; otherwise uses Node + better-sqlite3.
 */
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const { pathToFileURL } = require('url');
const database = require('./database.cjs');
const {
  PROJECT_ROOT,
  SEMANTIC_MODULES,
  BACKEND_MODULES,
  resolvePython,
  forgetPython,
  explainSemanticError,
  pythonSetupHint,
} = require('./python-env.cjs');

// FIX: previously `process.env.NODE_ENV !== 'production' || !app.isPackaged`,
// which is always true in a packaged app (NODE_ENV is unset there), so the
// packaged app tried to load http://127.0.0.1:5173. app.isPackaged is the
// reliable signal.
const isDev = !app.isPackaged;
const DATA_DIR = path.join(app.getPath('userData'), 'nexonote');
const USE_PYTHON_BACKEND = process.env.USE_PYTHON_BACKEND === '1' || process.env.NEXONOTE_USE_PYTHON_BACKEND === 'true';

let backendBaseUrl = null;
let pythonProcess = null;
let useNodeBackend = true;

// Custom protocol for serving imported PDFs to the renderer.
// The renderer is served from http://localhost:5173 (dev) or file:// (prod),
// so it cannot embed raw filesystem paths directly. PDFViewer requests
// nexopdf://pdf/<id> and this handler streams the file from disk.
// Must be registered before app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'nexopdf', privileges: { secure: true, supportFetchAPI: true, stream: true } },
  // standard: parse nexohf://host/path like a normal URL. corsEnabled plus the
  // Access-Control-Allow-Origin below let the file:// renderer fetch it, since
  // a packaged page is a different origin from the scheme.
  { scheme: 'nexohf', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true } },
]);

// Custom protocol for the AI assistant's Hugging Face calls.
//
// In dev the renderer is served by Vite, whose proxy forwards /api/hf to the
// Hugging Face router. A packaged app loads over file://, where that proxy does
// not exist and a relative request resolves to file:///api/hf, so the assistant
// could not work once installed. Calling the router directly from the renderer
// is not an option either: a file:// page sends Origin "null" and is refused.
//
// The main process has no such restriction, so it forwards the request with
// net.fetch and hands the streaming response straight back to the renderer.
const HF_ROUTER_ORIGIN = 'https://router.huggingface.co';
// Only these reach the network; the scheme is not a general-purpose proxy.
const HF_ALLOWED_PATHS = ['/v1/chat/completions'];

function registerHuggingFaceProtocol() {
  protocol.handle('nexohf', async (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    // The renderer is a different origin from this scheme, so preflight first.
    const CORS = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (!HF_ALLOWED_PATHS.includes(url.pathname)) {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    // Forward only what the API needs. The token stays in the Authorization
    // header the renderer set; the main process never stores or logs it.
    const headers = new Headers();
    for (const name of ['authorization', 'content-type', 'accept']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    let body;
    try {
      body = await request.arrayBuffer();
    } catch {
      return new Response('Unreadable request body', { status: 400 });
    }

    try {
      const upstream = await net.fetch(`${HF_ROUTER_ORIGIN}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
      });
      // Pass the body through unbuffered so token streaming still works.
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          ...CORS,
          'content-type': upstream.headers.get('content-type') || 'application/json',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: err?.message || 'Upstream request failed' } }),
        { status: 502, headers: { ...CORS, 'content-type': 'application/json' } }
      );
    }
  });
}

function registerPdfProtocol() {
  protocol.handle('nexopdf', async (request) => {
    try {
      const url = new URL(request.url);
      // nexopdf://pdf/<id> → host "pdf", pathname "/<id>"
      const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
      if (!id) return new Response('Bad request', { status: 400 });

      // Only the Node backend exposes a synchronous lookup. In Python-backend
      // mode the renderer talks to the HTTP backend for PDFs instead.
      if (!useNodeBackend) return new Response('Not available', { status: 404 });

      const pdf = database.pdfsGetById(id);
      const filePath = pdf?.filePath;
      if (!filePath || !filePath.toLowerCase().endsWith('.pdf') || !fs.existsSync(filePath)) {
        return new Response('Not found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('[nexopdf] failed to serve PDF:', err);
      return new Response('Internal error', { status: 500 });
    }
  });
}

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

async function startPythonBackend() {
  const { interpreter, tried } = await resolvePython(
    'backend',
    BACKEND_MODULES,
    process.env.NEXONOTE_BACKEND_PYTHON
  );
  if (!interpreter) {
    console.warn(pythonSetupHint('FastAPI backend', tried));
    return null;
  }
  return new Promise((resolve) => {
    const port = process.env.NEXONOTE_BACKEND_PORT || '8765';
    const baseUrl = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      NEXONOTE_DATA_DIR: DATA_DIR,
      NEXONOTE_BACKEND_PORT: port,
    };
    const child = spawn(
      interpreter.cmd,
      [...interpreter.args, '-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', port],
      { cwd: PROJECT_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }
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

  registerPdfProtocol();
  registerHuggingFaceProtocol();

  // Semantic linking: Python CLI (independent of data backend)
  ipcMain.handle('semantic-links:find', async (_, payload) => {
    const input = JSON.stringify({
      target_content: payload.target_content ?? '',
      notes: payload.notes ?? [],
      threshold: payload.threshold ?? 0.25,
      max_results: payload.max_results ?? 50,
      top_keywords: payload.top_keywords ?? 8,
    });

    const { interpreter, tried } = await resolvePython(
      'semantic',
      SEMANTIC_MODULES,
      process.env.NEXONOTE_SEMANTIC_PYTHON
    );
    if (!interpreter) {
      return {
        error: pythonSetupHint('semantic linking', tried),
      };
    }

    return new Promise((resolve) => {
      const proc = spawn(
        interpreter.cmd,
        [...interpreter.args, '-m', 'semantic_linking.cli'],
        { cwd: PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => { stdout += chunk; });
      proc.stderr.on('data', (chunk) => { stderr += chunk; });
      proc.on('error', (err) => {
        // The interpreter passed the probe, so this is a spawn failure, not a
        // missing Python. Drop the cache entry so the next call re-resolves.
        forgetPython('semantic');
        resolve({ error: err.message || 'Failed to run Python' });
      });
      proc.on('close', (code) => {
        try {
          const data = JSON.parse(stdout || '{}');
          if (data.error) resolve({ error: explainSemanticError(data.error) });
          else resolve({ links: data.links ?? [] });
        } catch {
          const raw = stderr || stdout || (code !== 0 ? `Exit ${code}` : 'Invalid response');
          resolve({ error: explainSemanticError(raw) });
        }
      });
      proc.stdin.write(input, () => proc.stdin.end());
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
