/**
 * Python interpreter discovery, shared by the Electron main process and the
 * repo's setup/dev scripts.
 *
 * Machines expose Python under different commands, and the Windows `py` launcher
 * exits non-zero (rather than ENOENT) when the requested version is absent, so a
 * hardcoded command has no chance to fall back. Probe candidates once per required
 * module set, keep the first that can import everything, and remember why the
 * others were rejected so callers can show an actionable message.
 *
 * Requires nothing from Electron, so plain `node scripts/*.cjs` can use it too.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const PYTHON_PROBE_TIMEOUT_MS = 10000;
// Failed lookups are cached only briefly, so installing the dependencies and
// retrying works without restarting the app.
const PYTHON_FAILURE_TTL_MS = 30000;
const SEMANTIC_MODULES = ['sklearn', 'nltk'];
const SEMANTIC_SERVER_MODULES = ['sklearn', 'nltk', 'flask'];
const BACKEND_MODULES = ['uvicorn', 'fastapi'];

const pythonResolutionCache = new Map();
const pythonProbesInFlight = new Map();

/** Path to the interpreter inside the project-local virtualenv, whether or not it exists. */
function venvPython() {
  return process.platform === 'win32'
    ? path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
}

/**
 * Interpreters to try, best first.
 * `bare: true` marks candidates usable for bootstrapping a virtualenv, where
 * only a working Python is needed and project dependencies are not yet present.
 */
function pythonCandidates(envOverride) {
  const candidates = [];
  if (envOverride) candidates.push({ cmd: envOverride, args: [] });
  const venv = venvPython();
  if (fs.existsSync(venv)) candidates.push({ cmd: venv, args: [] });
  if (process.platform === 'win32') {
    candidates.push({ cmd: 'py', args: ['-3'], bare: true });
    candidates.push({ cmd: 'python', args: [], bare: true });
  } else {
    candidates.push({ cmd: 'python3', args: [], bare: true });
    candidates.push({ cmd: 'python', args: [], bare: true });
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

/** Check whether a candidate can import every module in `modules`. */
function probePython(candidate, modules) {
  return new Promise((resolve) => {
    const script = modules.length ? `import ${modules.join(', ')}` : 'pass';
    let proc;
    try {
      proc = spawn(candidate.cmd, [...candidate.args, '-c', script], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
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

async function probeAllCandidates(key, modules, envOverride, filter) {
  const tried = [];
  for (const candidate of pythonCandidates(envOverride)) {
    if (filter && !filter(candidate)) continue;
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

/**
 * Resolve an interpreter that can import `modules`.
 * @returns {Promise<{ interpreter: {cmd: string, args: string[]}|null, tried: string[] }>}
 */
async function resolvePython(key, modules, envOverride, filter) {
  const cached = pythonResolutionCache.get(key);
  if (cached && (cached.interpreter || Date.now() - cached.at < PYTHON_FAILURE_TTL_MS)) {
    return cached;
  }
  // The sidebar and the graph view can both ask for links at once; share one
  // probe between them rather than spawning the candidate list twice.
  const inFlight = pythonProbesInFlight.get(key);
  if (inFlight) return inFlight;
  const probe = probeAllCandidates(key, modules, envOverride, filter);
  pythonProbesInFlight.set(key, probe);
  try {
    return await probe;
  } finally {
    pythonProbesInFlight.delete(key);
  }
}

/** Any working Python, for creating the virtualenv in the first place. */
function resolveBasePython(envOverride) {
  return resolvePython('base', [], envOverride, (c) => c.bare);
}

function forgetPython(key) {
  pythonResolutionCache.delete(key);
}

// The pipeline downloads its NLTK corpora on demand, which fails silently when
// the machine is offline and only surfaces as a LookupError further down.
function explainSemanticError(message) {
  const text = String(message || '').trim();
  if (/Resource\s+\S+\s+not found|LookupError|nltk\.download/i.test(text)) {
    return `${text}\n\nThe NLTK data files are missing.`
      + ` Run "npm run setup:python" to install them.`;
  }
  return text || 'Semantic linking failed';
}

function pythonSetupHint(what, tried) {
  const attempts = tried.length ? ` Tried: ${tried.join('; ')}.` : '';
  return `No Python installation with the ${what} dependencies was found.${attempts}`
    + ` Run "npm run setup:python" to set one up automatically.`;
}

module.exports = {
  PROJECT_ROOT,
  SEMANTIC_MODULES,
  SEMANTIC_SERVER_MODULES,
  BACKEND_MODULES,
  venvPython,
  pythonCandidates,
  describeInterpreter,
  probePython,
  resolvePython,
  resolveBasePython,
  forgetPython,
  explainSemanticError,
  pythonSetupHint,
};
