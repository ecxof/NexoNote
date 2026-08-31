/**
 * Differential check: JavaScript pipeline vs the Python one, same inputs.
 *
 * Runs each corpus through server.semantic.cli and through the JS port, then
 * reports score deltas and keyword differences. Not part of the test suite -
 * it exists to quantify how far the port drifts before trusting it.
 *
 * Run: node scripts/compare-semantic-impls.mjs
 */
import { spawn } from 'child_process';
import { findSemanticLinks } from '../src/features/semantic/tfidfPipeline.js';

const CORPORA = [
  {
    name: 'ml vs unrelated (suite fixture)',
    target: '<p>Backpropagation computes gradients for each layer of a neural network.</p>',
    notes: {
      a: '<p>Gradient descent updates neural network weights during training.</p>',
      b: '<p>Deadlock occurs when two processes each wait on a lock the other holds.</p>',
      c: '<p>Mitochondria produce ATP through oxidative phosphorylation.</p>',
    },
  },
  {
    name: 'plurals and verb forms (stemmer vs lemmatiser)',
    target: '<p>The running processes were computing gradients and updating weights.</p>',
    notes: {
      a: '<p>A process computes a gradient, then updates the weight.</p>',
      b: '<p>Studies studied the studying of studious students.</p>',
      c: '<p>Mice ran quickly past the geese and children.</p>',
    },
  },
  {
    name: 'irregular plurals and -ies',
    target: '<p>Theories of memory rely on hypotheses about neural activity.</p>',
    notes: {
      a: '<p>A theory of memory relies on a hypothesis about neural activities.</p>',
      b: '<p>Databases store relations between entities and attributes.</p>',
      c: '<p>Photosynthesis converts light energy into chemical energy.</p>',
    },
  },
  {
    name: 'shared boilerplate header',
    target: '<h1>Notes</h1><p>Course CS101 Dr Smith spring revision.</p><p>Backpropagation and gradients.</p>',
    notes: {
      a: '<h1>Notes</h1><p>Course CS101 Dr Smith spring revision.</p><p>Neural network training.</p>',
      b: '<h1>Notes</h1><p>Course CS101 Dr Smith spring revision.</p><p>Covalent bonds and atoms.</p>',
      c: '<h1>Notes</h1><p>Course CS101 Dr Smith spring revision.</p><p>Deadlock and mutexes.</p>',
    },
  },
  {
    name: 'markup, entities and punctuation',
    target: '<p>Gradient&nbsp;descent &amp; back-propagation: <em>don\'t</em> forget the chain rule!</p>',
    notes: {
      a: '<p>The chain rule underpins back-propagation; gradient descent applies it.</p>',
      b: '<p>Normalisation removes redundancy from relational database schemas.</p>',
      c: '<p>The Treaty of Westphalia ended the Thirty Years War in 1648.</p>',
    },
  },
  {
    name: 'repeated terms (sublinear tf)',
    target: '<p>network network network network gradient</p>',
    notes: {
      a: '<p>network gradient gradient gradient gradient</p>',
      b: '<p>mitochondria atp phosphorylation</p>',
      c: '<p>deadlock mutex thread</p>',
    },
  },
];

function runPython(target, notes) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      target_content: target,
      notes: Object.entries(notes).map(([id, content]) => ({ id, content })),
      threshold: 0.0,
      max_results: 50,
      top_keywords: 8,
    });
    const proc = spawn('py', ['-3', '-m', 'server.semantic.cli'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (c) => { out += c; });
    proc.stderr.on('data', (c) => { err += c; });
    proc.on('error', (e) => resolve({ error: e.message }));
    proc.on('close', () => {
      if (!out.trim()) return resolve({ error: err.trim() || 'no output' });
      try { resolve(JSON.parse(out)); } catch (e) { resolve({ error: e.message }); }
    });
    proc.stdin.write(payload, () => proc.stdin.end());
  });
}

const byId = (links) => Object.fromEntries(
  (links || []).map((l) => [l.linked_note_id, l]));

let worstDelta = 0;
let rankMismatches = 0;
let compared = 0;

for (const corpus of CORPORA) {
  const py = await runPython(corpus.target, corpus.notes);
  if (py.error) {
    console.log(`\n${corpus.name}\n  PYTHON ERROR: ${py.error.slice(0, 160)}`);
    continue;
  }
  const js = findSemanticLinks(corpus.target, corpus.notes, { threshold: 0.0, topKeywords: 8 });

  const pyById = byId(py.links);
  const jsById = byId(js);

  console.log(`\n${corpus.name}`);
  console.log('  id     python     js         delta    keywords match');
  for (const id of Object.keys(corpus.notes)) {
    const p = pyById[id]?.similarity_score ?? 0;
    const j = jsById[id]?.similarity_score ?? 0;
    const delta = Math.abs(p - j);
    worstDelta = Math.max(worstDelta, delta);
    compared += 1;
    const pk = (pyById[id]?.matched_keywords ?? []).join(',');
    const jk = (jsById[id]?.matched_keywords ?? []).join(',');
    const same = pk === jk ? 'same' : `py[${pk}] js[${jk}]`;
    console.log(`  ${id.padEnd(6)} ${p.toFixed(4).padEnd(10)} ${j.toFixed(4).padEnd(10)} ${delta.toFixed(4)}   ${same}`);
  }

  const pyOrder = (py.links || []).map((l) => l.linked_note_id).join('>');
  const jsOrder = js.map((l) => l.linked_note_id).join('>');
  if (pyOrder !== jsOrder) {
    rankMismatches += 1;
    console.log(`  RANK DIFFERS: python ${pyOrder} | js ${jsOrder}`);
  } else {
    console.log(`  rank: ${jsOrder || '(none)'} (same)`);
  }
}

console.log(`\n─── summary ───`);
console.log(`  pairs compared    : ${compared}`);
console.log(`  largest delta     : ${worstDelta.toFixed(4)}`);
console.log(`  ranking mismatches: ${rankMismatches}`);
