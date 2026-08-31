#!/usr/bin/env node
/**
 * One-shot bootstrap for NexoNote's optional Python features.
 *
 * Creates a project-local .venv and installs the FastAPI backend dependencies
 * into it. Electron prefers this virtualenv, so it removes any ambiguity about
 * which interpreter pip installed into.
 *
 * Python is optional now: it powers only the FastAPI storage backend. Semantic
 * linking runs in the app itself and needs nothing from here.
 *
 * Usage: npm run setup:python [-- --force]
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const {
  PROJECT_ROOT,
  venvPython,
  resolveBasePython,
  probePython,
  describeInterpreter,
} = require('../electron/python-env.cjs');


const args = process.argv.slice(2);
const force = args.includes('--force');

const colors = process.stdout.isTTY && !process.env.NO_COLOR;
const dim = (s) => (colors ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s) => (colors ? `\x1b[1m${s}\x1b[0m` : s);
const green = (s) => (colors ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s) => (colors ? `\x1b[31m${s}\x1b[0m` : s);

let step = 0;
function heading(text) {
  step += 1;
  console.log(`\n${bold(`[${step}] ${text}`)}`);
}

function run(cmd, cmdArgs, { capture = false, label } = {}) {
  return new Promise((resolve) => {
    console.log(dim(`    $ ${label || [cmd, ...cmdArgs].join(' ')}`));
    const proc = spawn(cmd, cmdArgs, {
      cwd: PROJECT_ROOT,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let out = '';
    if (capture) {
      proc.stdout.on('data', (c) => { out += c; });
      proc.stderr.on('data', (c) => { out += c; });
    }
    proc.on('error', (err) => resolve({ code: -1, out: err.message }));
    proc.on('close', (code) => resolve({ code, out }));
  });
}

function fail(message, detail) {
  console.error(`\n${red('Setup failed.')} ${message}`);
  if (detail) console.error(dim(detail));
  process.exit(1);
}

async function main() {
  console.log(bold('NexoNote Python setup'));

  const venv = venvPython();
  const venvDir = path.join(PROJECT_ROOT, '.venv');

  heading('Locating a Python interpreter');
  if (force && fs.existsSync(venvDir)) {
    console.log(dim('    --force: removing existing .venv'));
    fs.rmSync(venvDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(venv)) {
    const { interpreter, tried } = await resolveBasePython(process.env.NEXONOTE_PYTHON);
    if (!interpreter) {
      fail(
        'No Python 3 installation was found.',
        `Tried: ${tried.join('; ')}\nInstall Python 3.9+ from https://www.python.org/downloads/ `
          + 'and make sure it is on your PATH, then run this again.'
      );
    }
    console.log(`    Using ${green(describeInterpreter(interpreter))} to create the virtualenv`);

    heading('Creating .venv');
    const created = await run(interpreter.cmd, [...interpreter.args, '-m', 'venv', '.venv']);
    if (created.code !== 0 || !fs.existsSync(venv)) {
      fail(
        'Could not create the virtualenv.',
        'On Debian/Ubuntu this usually means the python3-venv package is missing:\n'
          + '  sudo apt install python3-venv'
      );
    }
  } else {
    console.log(`    Reusing existing virtualenv at ${green('.venv')}`);
    heading('Creating .venv');
    console.log(dim('    already present, skipping (pass --force to recreate)'));
  }

  heading('Installing dependencies');
  const upgraded = await run(venv, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet']);
  if (upgraded.code !== 0) console.log(dim('    pip self-upgrade skipped'));

  const installed = await run(venv, ['-m', 'pip', 'install', '-r', 'server/api/requirements.txt']);
  if (installed.code !== 0) fail('pip could not install server/api/requirements.txt.');

  heading('Verifying the installation');
  const check = await probePython({ cmd: venv, args: [] }, ['uvicorn', 'fastapi']);
  if (!check.ok) fail(`The virtualenv is missing packages after install (${check.reason}).`);
  console.log('    FastAPI backend dependencies OK');

  console.log(`\n${green('Setup complete.')} Electron and "npm run dev" will use .venv automatically.`);
  console.log(dim('  npm run dev            browser'));
  console.log(dim('  npm run electron:dev   desktop app'));
}

main().catch((err) => fail(err.message, err.stack));
