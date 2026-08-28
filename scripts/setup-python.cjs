#!/usr/bin/env node
/**
 * One-shot bootstrap for NexoNote's optional Python features.
 *
 * Creates a project-local .venv, installs the semantic linking and FastAPI
 * backend dependencies into it, and downloads the NLTK corpora. Electron and
 * `npm run dev` prefer this virtualenv, so it removes any ambiguity about
 * which interpreter pip installed into.
 *
 * Usage: npm run setup:python [-- --force] [-- --no-backend]
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

// word_tokenize needs punkt_tab on nltk >= 3.9; punkt alone is not enough.
const NLTK_RESOURCES = ['punkt', 'punkt_tab', 'stopwords', 'wordnet'];

const args = process.argv.slice(2);
const force = args.includes('--force');
const withBackend = !args.includes('--no-backend');

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

  const requirements = ['server/semantic/requirements.txt'];
  if (withBackend) requirements.push('server/api/requirements.txt');
  for (const req of requirements) {
    const installed = await run(venv, ['-m', 'pip', 'install', '-r', req]);
    if (installed.code !== 0) fail(`pip could not install ${req}.`);
  }

  heading('Downloading NLTK data');
  const downloaded = await run(venv, ['-c',
    `import nltk; [nltk.download(r) for r in ${JSON.stringify(NLTK_RESOURCES)}]`],
    { label: 'python -m nltk.downloader ' + NLTK_RESOURCES.join(' ') });
  if (downloaded.code !== 0) {
    fail(
      'Could not download the NLTK corpora.',
      'This step needs network access. Once online, rerun "npm run setup:python".'
    );
  }

  heading('Verifying the installation');
  const check = await probePython({ cmd: venv, args: [] }, ['sklearn', 'nltk', 'flask']);
  if (!check.ok) fail(`The virtualenv is missing packages after install (${check.reason}).`);

  // Exercise the real pipeline, which catches missing corpora that a plain
  // import check would not. Needs three documents: with only two, max_df=0.85
  // drops every term they share and nothing can score above zero.
  const smoke = await run(venv, ['-c', [
    'from server.semantic import find_semantic_links',
    'links = find_semantic_links("<p>Gradient descent trains neural networks.</p>", {',
    '  "a": "<p>Backpropagation computes gradients for neural networks.</p>",',
    '  "b": "<p>Deadlock occurs when two processes wait on each other.</p>",',
    '}, threshold=0.1)',
    'assert links, "pipeline returned no links for obviously related notes"',
    'assert links[0]["linked_note_id"] == "a", "pipeline ranked an unrelated note first"',
    'print("    related note matched on:", ", ".join(links[0]["matched_keywords"]))',
  ].join('\n')], { capture: true, label: 'semantic linking smoke test' });
  if (smoke.code !== 0) {
    fail('The semantic linking pipeline did not run.', smoke.out.trim());
  }
  process.stdout.write(smoke.out);

  if (withBackend) {
    const backendCheck = await probePython({ cmd: venv, args: [] }, ['uvicorn', 'fastapi']);
    console.log(backendCheck.ok
      ? '    FastAPI backend dependencies OK'
      : dim(`    FastAPI backend dependencies unavailable (${backendCheck.reason})`));
  }

  console.log(`\n${green('Setup complete.')} Electron and "npm run dev" will use .venv automatically.`);
  console.log(dim('  npm run dev            browser + semantic linking server'));
  console.log(dim('  npm run electron:dev   desktop app'));
}

main().catch((err) => fail(err.message, err.stack));
