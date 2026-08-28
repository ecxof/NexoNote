#!/usr/bin/env node
/**
 * Starts the FastAPI backend for local development.
 *
 * Run directly with `npm run server:python`. Electron starts its own copy of
 * this server when USE_PYTHON_BACKEND=1; this script is for working on the
 * backend without launching the desktop app.
 *
 * Unlike the dev-mode semantic server, a missing Python is a hard error here:
 * the script does nothing else, so there is no reason to exit 0 and pretend.
 */
const { spawn } = require('child_process');

const {
  PROJECT_ROOT,
  BACKEND_MODULES,
  resolvePython,
  describeInterpreter,
  pythonSetupHint,
} = require('../electron/python-env.cjs');

const colors = process.stdout.isTTY && !process.env.NO_COLOR;
const dim = (s) => (colors ? `\x1b[2m${s}\x1b[0m` : s);
const red = (s) => (colors ? `\x1b[31m${s}\x1b[0m` : s);

async function main() {
  const port = process.env.NEXONOTE_BACKEND_PORT || '8765';

  const { interpreter, tried } = await resolvePython(
    'backend',
    BACKEND_MODULES,
    process.env.NEXONOTE_BACKEND_PYTHON
  );
  if (!interpreter) {
    console.error(red(pythonSetupHint('FastAPI backend', tried)));
    process.exit(1);
  }

  const args = [
    ...interpreter.args,
    '-m', 'uvicorn', 'server.api.main:app',
    '--host', '127.0.0.1',
    '--port', port,
    '--reload',
  ];
  console.log(dim(`FastAPI backend: ${describeInterpreter(interpreter)} -m uvicorn server.api.main:app --port ${port}`));

  const proc = spawn(interpreter.cmd, args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, NEXONOTE_BACKEND_PORT: port },
    stdio: 'inherit',
  });

  proc.on('error', (err) => {
    console.error(red(err.message || 'Failed to start the backend'));
    process.exit(1);
  });
  // Ctrl+C reaches the child directly; that is a normal shutdown.
  proc.on('close', (code) => process.exit(code === null ? 0 : code));

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      try { proc.kill(signal); } catch (_) {}
    });
  }
}

main();
