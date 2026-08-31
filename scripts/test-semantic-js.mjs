/**
 * Ports server/tests/test_semantic_linking.py to the JavaScript pipeline.
 *
 * Same fixtures, same assertions, same order, so a pass here means the port
 * upholds the properties the Python suite pins. Run: node scripts/test-semantic-js.mjs
 */
import {
  findSemanticLinks,
  MAX_DF_RATIO,
  stripHtml,
} from '../src/features/semantic/tfidfPipeline.js';

const MIN_SCORABLE_CANDIDATES = 2;
const SIDEBAR_THRESHOLD = 0.25;
const GRAPH_THRESHOLD = 0.2;

const ML_TARGET = '<p>Backpropagation computes gradients for each layer of a neural network.</p>';
const ML_RELATED = '<p>Gradient descent updates neural network weights during training.</p>';
const UNRELATED = [
  '<p>Deadlock occurs when two processes each wait on a lock the other holds.</p>',
  '<p>Mitochondria produce ATP through oxidative phosphorylation.</p>',
  '<p>Covalent bonds share electron pairs between atoms.</p>',
  '<p>A mutex prevents two threads entering a critical section at once.</p>',
  '<p>Normalisation removes redundancy from relational database schemas.</p>',
  '<p>The Treaty of Westphalia ended the Thirty Years War in 1648.</p>',
];
const TEMPLATE =
  '<h1>Study notes</h1><p>Course: CS101. Instructor: Dr Smith. Term: spring. ' +
  'Tags: coursework, revision, midterm.</p>';

function corpusOf(nCandidates) {
  const docs = [ML_RELATED, ...UNRELATED.slice(0, nCandidates - 1)];
  return Object.fromEntries(docs.map((doc, i) => [`note-${i}`, doc]));
}
const scoreFor = (links, id) =>
  links.find((l) => l.linked_note_id === id)?.similarity_score ?? 0.0;

// ─── tiny test harness ──────────────────────────────────────────────────────
let passed = 0;
const failures = [];
let suite = '';
const describe = (name) => { suite = name; };
function it(name, fn) {
  try { fn(); passed += 1; }
  catch (e) { failures.push({ suite, name, message: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const eq = (a, b, msg) =>
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg || 'not equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

// ─── SmallCorpusLimitation ──────────────────────────────────────────────────
describe('SmallCorpusLimitation');

it('single related candidate is not linked', () => {
  const links = findSemanticLinks(ML_TARGET, { a: ML_RELATED }, { threshold: SIDEBAR_THRESHOLD });
  eq(links, [], 'a two-note corpus cannot produce a score');
});

it('single related candidate scores exactly zero', () => {
  const links = findSemanticLinks(ML_TARGET, { a: ML_RELATED }, { threshold: 0.0 });
  assert(scoreFor(links, 'a') === 0.0, `expected 0, got ${scoreFor(links, 'a')}`);
});

it('even identical notes are not linked', () => {
  const links = findSemanticLinks(ML_TARGET, { a: ML_TARGET }, { threshold: SIDEBAR_THRESHOLD });
  eq(links, [], 'identical notes still cannot be scored with two documents');
});

it('boilerplate cannot manufacture a link either', () => {
  const links = findSemanticLinks(
    TEMPLATE + ML_TARGET,
    { a: TEMPLATE + UNRELATED[1] },
    { threshold: SIDEBAR_THRESHOLD },
  );
  eq(links, [], 'the two-note case must fail closed');
});

it('two candidates score normally', () => {
  const links = findSemanticLinks(ML_TARGET, corpusOf(MIN_SCORABLE_CANDIDATES), { threshold: 0.0 });
  assert(scoreFor(links, 'note-0') > 0.0, 'related pair must score above zero');
  assert(links[0].linked_note_id === 'note-0', 'related note must rank first');
});

// ─── BoilerplateRejection ───────────────────────────────────────────────────
describe('BoilerplateRejection');

it('shared template does not link unrelated notes', () => {
  const candidates = Object.fromEntries(
    UNRELATED.slice(0, 5).map((doc, i) => [`note-${i}`, TEMPLATE + doc]),
  );
  const links = findSemanticLinks(TEMPLATE + ML_TARGET, candidates, { threshold: GRAPH_THRESHOLD });
  eq(links, [], 'boilerplate must not create links in a normal corpus');
});

it('template words are not returned as keywords', () => {
  const candidates = { 'note-0': TEMPLATE + ML_RELATED };
  UNRELATED.slice(0, 4).forEach((doc, i) => { candidates[`note-${i + 1}`] = TEMPLATE + doc; });
  const links = findSemanticLinks(TEMPLATE + ML_TARGET, candidates, { threshold: 0.0 });
  const keywords = new Set(links[0].matched_keywords);
  for (const word of ['smith', 'course', 'term', 'revision', 'midterm']) {
    assert(!keywords.has(word), `template word "${word}" leaked into keywords`);
  }
});

it('max_df ratio is not relaxed', () => {
  assert(MAX_DF_RATIO < 1.0, 'max_df at 1.0 lets boilerplate link everything');
});

// ─── ScoreConsistencyAsCorpusGrows ──────────────────────────────────────────
describe('ScoreConsistencyAsCorpusGrows');

const sizes = [];
for (let n = MIN_SCORABLE_CANDIDATES; n <= UNRELATED.length + 1; n += 1) sizes.push(n);
const scores = sizes.map((n) =>
  scoreFor(findSemanticLinks(ML_TARGET, corpusOf(n), { threshold: 0.0 }), 'note-0'));

it('related pair scores above zero at every size', () => {
  sizes.forEach((size, i) => assert(scores[i] > 0.0, `size ${size} scored ${scores[i]}`));
});

it('scores stay in range', () => {
  sizes.forEach((size, i) =>
    assert(scores[i] >= 0.0 && scores[i] <= 1.0, `size ${size} out of range: ${scores[i]}`));
});

it('no discontinuity as the corpus grows', () => {
  for (let i = 1; i < scores.length; i += 1) {
    const delta = Math.abs(scores[i] - scores[i - 1]);
    assert(delta < 0.05,
      `score jumped by ${delta.toFixed(3)} between ${sizes[i - 1]} and ${sizes[i]} candidates`);
  }
});

it('score does not decrease as unrelated notes are added', () => {
  for (let i = 1; i < scores.length; i += 1) {
    assert(scores[i] >= scores[i - 1] - 1e-9,
      `score fell from ${scores[i - 1]} to ${scores[i]}`);
  }
});

it('related note outranks unrelated at every size', () => {
  for (const n of sizes) {
    const links = findSemanticLinks(ML_TARGET, corpusOf(n), { threshold: 0.0 });
    assert(links[0].linked_note_id === 'note-0', `at ${n} candidates the top hit was ${links[0]?.linked_note_id}`);
  }
});

// ─── Contract ───────────────────────────────────────────────────────────────
describe('Contract');

it('empty corpus returns empty', () => eq(findSemanticLinks(ML_TARGET, {}), []));
it('empty target returns empty', () => eq(findSemanticLinks('', { a: ML_RELATED }), []));

it('threshold is applied', () => {
  const loose = findSemanticLinks(ML_TARGET, corpusOf(4), { threshold: 0.0 });
  const strict = findSemanticLinks(ML_TARGET, corpusOf(4), { threshold: 0.99 });
  assert(loose.length > 0, 'loose threshold should return links');
  eq(strict, [], 'strict threshold should return none');
});

it('max results is applied', () => {
  const links = findSemanticLinks(ML_TARGET, corpusOf(5), { threshold: 0.0, maxResults: 1 });
  assert(links.length <= 1, `expected at most 1, got ${links.length}`);
});

it('results are sorted by score descending', () => {
  const s = findSemanticLinks(ML_TARGET, corpusOf(6), { threshold: 0.0 })
    .map((l) => l.similarity_score);
  eq(s, [...s].sort((a, b) => b - a), 'results must be sorted descending');
});

it('matched keywords are returned', () => {
  const links = findSemanticLinks(ML_TARGET, corpusOf(4), { threshold: 0.0 });
  assert(links[0].matched_keywords.length > 0, 'expected keywords');
  assert(links[0].matched_keywords.includes('neural'),
    `expected "neural" in ${JSON.stringify(links[0].matched_keywords)}`);
});

it('html is stripped before scoring', () => {
  const candidates = corpusOf(4);
  const wrapped = { ...candidates, 'note-0': `<div><em>${candidates['note-0']}</em></div>` };
  const plainScore = scoreFor(findSemanticLinks(ML_TARGET, candidates, { threshold: 0.0 }), 'note-0');
  const wrappedScore = scoreFor(findSemanticLinks(ML_TARGET, wrapped, { threshold: 0.0 }), 'note-0');
  assert(Math.abs(plainScore - wrappedScore) < 1e-4,
    `markup changed the score: ${plainScore} vs ${wrappedScore}`);
});

// ─── ScoringParametersDoNotDrift (see note below) ───────────────────────────
describe('ScoringParametersDoNotDrift');
it('stripHtml collapses markup and entities', () => {
  assert(stripHtml('<p>a&nbsp;&amp;&nbsp;b</p>') === 'a & b', stripHtml('<p>a&nbsp;&amp;&nbsp;b</p>'));
});

// ─── report ─────────────────────────────────────────────────────────────────
const total = passed + failures.length;
console.log(`\nRan ${total} tests`);
if (failures.length === 0) {
  console.log('OK');
} else {
  console.log(`FAILED (failures=${failures.length})\n`);
  for (const f of failures) console.log(`  [${f.suite}] ${f.name}\n      ${f.message}`);
}
console.log('\nObserved scores as the corpus grows (related pair):');
sizes.forEach((n, i) => console.log(`  ${n} candidates: ${scores[i].toFixed(4)}`));
process.exit(failures.length === 0 ? 0 : 1);
