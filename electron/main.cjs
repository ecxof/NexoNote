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
]);

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

// ─── Python interpreter resolution ───────────────────────────────────────────
// Machines expose Python under different commands, and the Windows `py` launcher
// exits non-zero (rather than ENOENT) when the requested version is absent, so a
// hardcoded command has no chance to fall back. Probe candidates once per required
// module set, keep the first that can import everything, and remember why the
// others were rejected so the renderer can show an actionable message.
const PROJECT_ROOT = path.join(__dirname, '..');
const PYTHON_PROBE_TIMEOUT_MS = 10000;
// Failed lookups are cached only briefly, so installing the dependencies and
// retrying works without restarting the app.
const PYTHON_FAILURE_TTL_MS = 30000;
const SEMANTIC_MODULES = ['sklearn', 'nltk'];
const BACKEND_MODULES = ['uvicorn', 'fastapi'];

const pythonResolutionCache = new Map();
const pythonProbesInFlight = new Map();

function pythonCandidates(envOverride) {
  const candidates = [];
  if (envOverride) candidates.push({ cmd: envOverride, args: [] });
  const venvPython = process.platform === 'win32'
    ? path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) candidates.push({ cmd: venvPython, args: [] });
  if (process.platform === 'win32') {
    candidates.push({ cmd: 'py', args: ['-3'] });
    candidates.push({ cmd: 'python', args: [] });
  } else {
    candidates.push({ cmd: 'python3', args: [] });
    candidates.push({ cmd: 'python', args: [] });
  }
  return candidates;
}

function describeInterpreter({ cmd, args }) {
  return [cmd, ...args].join(' ');
}

function summarizePythonError(stderr, code) {
  const missing = /No module named '([^']+)'/.exec(stderr);
  if (missing) return `missing ${missing[1]}`;
  if (/No suitable Python runtime/i.test(stderr)) return 'no matching runtime';
  const lastLine = stderr.trim().split(/\r?\n/).filter(Boolean).pop();
  return lastLine || `exit ${code}`;
}

// Resolve a candidate that can import every module in `modules`.
function probePython(candidate, modules) {
  return new Promise((resolve) => {
    const args = [...candidate.args, '-c', `import ${modules.join(', ')}`];
    let proc;
    try {
      proc = spawn(candidate.cmd, args, { cwd: PROJECT_ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      resolve({ ok: false, reason: err.message });
      return;
    }
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      finish({ ok: false, reason: 'timed out' });
    }, PYTHON_PROBE_TIMEOUT_MS);
    proc.stderr?.on('data', (chunk) => { stderr += chunk; });
    proc.on('error', (err) => {
      finish({ ok: false, reason: err.code === 'ENOENT' ? 'not found' : err.message });
    });
    proc.on('close', (code) => {
      finish(code === 0 ? { ok: true } : { ok: false, reason: summarizePythonError(stderr, code) });
    });
  });
}

async function resolvePython(key, modules, envOverride) {
  const cached = pythonResolutionCache.get(key);
  if (cached && (cached.interpreter || Date.now() - cached.at < PYTHON_FAILURE_TTL_MS)) {
    return cached;
  }
  // The sidebar and the graph view can both ask for links at once; share one
  // probe between them rather than spawning the candidate list twice.
  const inFlight = pythonProbesInFlight.get(key);
  if (inFlight) return inFlight;
  const probe = probeAllCandidates(key, modules, envOverride);
  pythonProbesInFlight.set(key, probe);
  try {
    return await probe;
  } finally {
    pythonProbesInFlight.delete(key);
  }
}

async function probeAllCandidates(key, modules, envOverride) {
  const tried = [];
  for (const candidate of pythonCandidates(envOverride)) {
    const result = await probePython(candidate, modules);
    if (result.ok) {
      const resolved = { interpreter: candidate, tried, at: Date.now() };
      pythonResolutionCache.set(key, resolved);
      return resolved;
    }
    tried.push(`${describeInterpreter(candidate)} (${result.reason})`);
  }
  const resolved = { interpreter: null, tried, at: Date.now() };
  pythonResolutionCache.set(key, resolved);
  return resolved;
}

// The pipeline downloads its NLTK corpora on demand, which fails silently when
// the machine is offline and only surfaces as a LookupError further down.
function explainSemanticError(message) {
  const text = String(message || '').trim();
  if (/Resource\s+\S+\s+not found|LookupError|nltk\.download/i.test(text)) {
    return `${text}\n\nThe NLTK data files are missing.`
      + ` Download them once with "python -m nltk.downloader punkt stopwords wordnet".`;
  }
  return text || 'Semantic linking failed';
}

function pythonSetupHint(what, requirements, envVar, tried) {
  const attempts = tried.length ? ` Tried: ${tried.join('; ')}.` : '';
  return `No Python installation with the ${what} dependencies was found.${attempts}`
    + ` Install them with "python -m pip install -r ${requirements}",`
    + ` or set ${envVar} to the full path of a Python that has them.`;
}

async function startPythonBackend() {
  const { interpreter, tried } = await resolvePython(
    'backend',
    BACKEND_MODULES,
    process.env.NEXONOTE_BACKEND_PYTHON
  );
  if (!interpreter) {
    console.warn(pythonSetupHint('FastAPI backend', 'backend/requirements.txt', 'NEXONOTE_BACKEND_PYTHON', tried));
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
        error: pythonSetupHint(
          'semantic linking',
          'semantic_linking/requirements.txt',
          'NEXONOTE_SEMANTIC_PYTHON',
          tried
        ),
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
        pythonResolutionCache.delete('semantic');
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
