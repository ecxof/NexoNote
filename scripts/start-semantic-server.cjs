#!/usr/bin/env node
/**
 * Starts the semantic linking HTTP server for browser dev mode.
 *
 * Runs alongside Vite in `npm run dev`. Semantic linking is optional, so a
 * missing or incomplete Python install is reported as a hint and exits 0 —
 * the dev server must keep running either way.
 */
const { spawn } = require('child_process');

const {
  PROJECT_ROOT,
  SEMANTIC_SERVER_MODULES,
  resolvePython,
  describeInterpreter,
} = require('../electron/python-env.cjs');

const colors = process.stdout.isTTY && !process.env.NO_COLOR;
const dim = (s) => (colors ? `\x1b[2m${s}\x1b[0m` : s);
const yellow = (s) => (colors ? `\x1b[33m${s}\x1b[0m` : s);

function skip(reason, tried) {
  console.log(yellow('Semantic linking is not available in the browser.'));
  console.log(dim(`  ${reason}`));
  if (tried?.length) console.log(dim(`  Tried: ${tried.join('; ')}`));
  console.log(dim('  Run "npm run setup:python" to enable it. The app runs fine without it.'));
  process.exit(0);
}

async function main() {
  const { interpreter, tried } = await resolvePython(
    'semantic-server',
    SEMANTIC_SERVER_MODULES,
    process.env.NEXONOTE_SEMANTIC_PYTHON
  );
  if (!interpreter) {
    skip('No Python with scikit-learn, nltk and flask was found.', tried);
    return;
  }

  console.log(dim(`Semantic linking server: ${describeInterpreter(interpreter)} -m semantic_linking.server`));
  const proc = spawn(
    interpreter.cmd,
    [...interpreter.args, '-m', 'semantic_linking.server'],
    { cwd: PROJECT_ROOT, stdio: 'inherit' }
  );

  proc.on('error', (err) => skip(err.message));
  proc.on('close', (code) => {
    // Ctrl+C reaches the child directly; that is a normal shutdown, not a failure.
    process.exit(code === 0 || code === null ? 0 : code);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      try { proc.kill(signal); } catch (_) {}
    });
  }
}

main();
