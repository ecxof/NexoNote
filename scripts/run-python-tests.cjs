#!/usr/bin/env node
/**
 * Runs the Python test suite with the same interpreter the app would use,
 * so tests never silently run against a different environment.
 *
 * Usage: npm run test:python [-- <unittest args>]
 */
const { spawn } = require('child_process');

const {
  PROJECT_ROOT,
  SEMANTIC_MODULES,
  resolvePython,
  describeInterpreter,
  pythonSetupHint,
} = require('../electron/python-env.cjs');

async function main() {
  const { interpreter, tried } = await resolvePython(
    'semantic',
    SEMANTIC_MODULES,
    process.env.NEXONOTE_SEMANTIC_PYTHON
  );
  if (!interpreter) {
    console.error(pythonSetupHint('semantic linking', tried));
    process.exit(1);
  }

  const extra = process.argv.slice(2);
  const args = [...interpreter.args, '-m', 'unittest'];
  args.push(...(extra.length ? extra : ['discover', '-s', 'tests', '-t', '.', '-v']));

  console.log(`${describeInterpreter(interpreter)} -m unittest ${args.slice(interpreter.args.length + 2).join(' ')}`);
  const proc = spawn(interpreter.cmd, args, { cwd: PROJECT_ROOT, stdio: 'inherit' });
  proc.on('error', (err) => {
    console.error(err.message);
    process.exit(1);
  });
  proc.on('close', (code) => process.exit(code ?? 1));
}

main();
