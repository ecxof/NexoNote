/**
 * Semantic linking pipeline, in JavaScript.
 *
 * A port of server/semantic/pipeline.py. The scoring maths is reproduced
 * exactly as scikit-learn computes it, so results are comparable:
 *
 *   sublinear tf : tf = 1 + ln(count)
 *   smooth idf   : idf = ln((1 + n) / (1 + df)) + 1
 *   l2 norm      : each document vector scaled to unit length
 *   cosine       : dot product of two unit vectors
 *   max_df       : a term is kept when df <= MAX_DF_RATIO * n
 *
 * Two steps cannot be reproduced without their data files, and are the only
 * deliberate differences from the Python version:
 *
 *   tokenising   : NLTK's word_tokenize needs the punkt models (47 MB), so this
 *                  uses the same regex the Python code falls back to when NLTK
 *                  is unavailable.
 *   lemmatising  : WordNet is an 11 MB corpus, so this uses a Porter stemmer.
 *                  Stems are internal only - matched keywords are mapped back
 *                  to the words that actually appear in the note, exactly as
 *                  the Python version maps lemmas back.
 *
 * Both shift absolute scores slightly. Ordering, thresholds and the boilerplate
 * rejection that max_df provides are unaffected.
 */

import { STOP_WORDS } from './stopWords.js';

// A term appearing in more than this proportion of documents is dropped. It is
// what stops shared boilerplate linking every note to every other one; TF-IDF
// alone will not, since a term present everywhere still carries idf 1.0 rather
// than 0. See the Limitations section of the semantic linking docs.
export const MAX_DF_RATIO = 0.85;

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/** Strip HTML tags from editor output and normalise whitespace. */
export function stripHtml(html) {
  if (!html || !html.trim()) return '';
  let text = String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  for (const [entity, value] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(value);
  }
  return text.split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Lowercase and split into word tokens.
 *
 * Internal hyphens and apostrophes are kept, so "back-propagation" stays a
 * single token as NLTK's word_tokenize treats it, rather than splitting into
 * two terms that then match unrelated notes containing either half.
 */
export function tokenize(text) {
  const lowered = (text || '').toLowerCase().trim();
  if (!lowered) return [];
  return lowered.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) || [];
}

// ─── Porter stemmer ─────────────────────────────────────────────────────────
// Standard Porter (1980). Stands in for WordNet lemmatisation, which would need
// an 11 MB corpus. Produces stems rather than dictionary words, which is fine
// because stems are never shown - see recoverSurfaceForms.

const VOWELS = 'aeiou';
const isConsonant = (word, i) => {
  const ch = word[i];
  if (VOWELS.includes(ch)) return false;
  if (ch !== 'y') return true;
  return i === 0 ? true : !isConsonant(word, i - 1);
};

/** Number of vowel-consonant sequences, the "measure" m in Porter's paper. */
function measure(stem) {
  let n = 0;
  let i = 0;
  while (i < stem.length && isConsonant(stem, i)) i += 1;
  while (i < stem.length) {
    while (i < stem.length && !isConsonant(stem, i)) i += 1;
    if (i >= stem.length) break;
    n += 1;
    while (i < stem.length && isConsonant(stem, i)) i += 1;
  }
  return n;
}

const containsVowel = (stem) => {
  for (let i = 0; i < stem.length; i += 1) if (!isConsonant(stem, i)) return true;
  return false;
};

const endsDoubleConsonant = (w) =>
  w.length >= 2 && w[w.length - 1] === w[w.length - 2] && isConsonant(w, w.length - 1);

/** consonant-vowel-consonant where the final consonant is not w, x or y. */
const endsCvc = (w) => {
  if (w.length < 3) return false;
  const last = w.length - 1;
  return (
    isConsonant(w, last) &&
    !isConsonant(w, last - 1) &&
    isConsonant(w, last - 2) &&
    !'wxy'.includes(w[last])
  );
};

const STEP2 = [
  ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
  ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'],
  ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
  ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
  ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
];
const STEP3 = [
  ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
  ['ical', 'ic'], ['ful', ''], ['ness', ''],
];
const STEP4 = [
  'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment',
  'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
];

export function stem(word) {
  let w = word;
  if (w.length <= 2) return w;

  // Step 1a - plurals.
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (w.endsWith('ss')) { /* keep */ }
  else if (w.endsWith('s')) w = w.slice(0, -1);

  // Step 1b - past tense and gerunds.
  let step1bApplied = false;
  if (w.endsWith('eed')) {
    if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
  } else if (w.endsWith('ed') && containsVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
    step1bApplied = true;
  } else if (w.endsWith('ing') && containsVowel(w.slice(0, -3))) {
    w = w.slice(0, -3);
    step1bApplied = true;
  }
  if (step1bApplied) {
    if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
    else if (endsDoubleConsonant(w) && !'lsz'.includes(w[w.length - 1])) w = w.slice(0, -1);
    else if (measure(w) === 1 && endsCvc(w)) w += 'e';
  }

  // Step 1c - y to i.
  if (w.endsWith('y') && containsVowel(w.slice(0, -1))) w = `${w.slice(0, -1)}i`;

  // Steps 2 and 3 - derivational suffixes.
  for (const [suffix, replacement] of STEP2) {
    if (w.endsWith(suffix)) {
      const base = w.slice(0, -suffix.length);
      if (measure(base) > 0) w = base + replacement;
      break;
    }
  }
  for (const [suffix, replacement] of STEP3) {
    if (w.endsWith(suffix)) {
      const base = w.slice(0, -suffix.length);
      if (measure(base) > 0) w = base + replacement;
      break;
    }
  }

  // Step 4 - strip suffixes from longer stems.
  for (const suffix of STEP4) {
    if (w.endsWith(suffix)) {
      const base = w.slice(0, -suffix.length);
      if (measure(base) > 1) {
        if (suffix !== 'ion' || /[st]$/.test(base)) w = base;
      }
      break;
    }
  }

  // Step 5 - tidy up a trailing e and doubled l.
  if (w.endsWith('e')) {
    const base = w.slice(0, -1);
    const m = measure(base);
    if (m > 1 || (m === 1 && !endsCvc(base))) w = base;
  }
  if (measure(w) > 1 && endsDoubleConsonant(w) && w.endsWith('l')) w = w.slice(0, -1);

  return w;
}

/** Strip HTML, tokenise, drop stop words, and stem. Mirrors the Python analyzer. */
export function analyze(text) {
  const tokens = tokenize(stripHtml(text));
  const out = [];
  for (const token of tokens) {
    if (token.length < 2 || STOP_WORDS.has(token)) continue;
    out.push(stem(token));
  }
  return out;
}

// ─── TF-IDF ─────────────────────────────────────────────────────────────────

function buildMatrix(documents) {
  const analyzed = documents.map(analyze);
  const documentFrequency = new Map();
  const counts = analyzed.map((tokens) => {
    const perDoc = new Map();
    for (const term of tokens) perDoc.set(term, (perDoc.get(term) || 0) + 1);
    for (const term of perDoc.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
    return perDoc;
  });

  // scikit-learn keeps a term when df <= max_df * n_documents.
  const limit = MAX_DF_RATIO * documents.length;
  const vocabulary = [];
  for (const [term, df] of documentFrequency) {
    if (df <= limit && df >= 1) vocabulary.push(term);
  }
  vocabulary.sort();

  return { analyzed, counts, documentFrequency, vocabulary };
}

/**
 * Build unit-length TF-IDF vectors, one per document.
 * @returns {{ vectors: Map<string, number>[], vocabulary: string[] }}
 */
export function vectorize(documents) {
  const { counts, documentFrequency, vocabulary } = buildMatrix(documents);
  if (vocabulary.length === 0) return { vectors: [], vocabulary: [] };

  const n = documents.length;
  const idf = new Map();
  for (const term of vocabulary) {
    idf.set(term, Math.log((1 + n) / (1 + documentFrequency.get(term))) + 1);
  }

  const keep = new Set(vocabulary);
  const vectors = counts.map((perDoc) => {
    const vector = new Map();
    let sumSquares = 0;
    for (const [term, count] of perDoc) {
      if (!keep.has(term)) continue;
      const weight = (1 + Math.log(count)) * idf.get(term);
      vector.set(term, weight);
      sumSquares += weight * weight;
    }
    if (sumSquares > 0) {
      const norm = Math.sqrt(sumSquares);
      for (const [term, weight] of vector) vector.set(term, weight / norm);
    }
    return vector;
  });

  return { vectors, vocabulary };
}

/** Cosine similarity of two unit-length sparse vectors. */
function cosine(a, b) {
  // Iterate the smaller vector so the cost follows the shorter note.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  return dot;
}

/**
 * Map a stem back to the words that actually appear in the note, so highlights
 * show what the user wrote rather than an internal stem.
 */
function recoverSurfaceForms(target, plainText, maxForms = 3) {
  const seen = new Set();
  const forms = [];
  for (const token of tokenize(plainText)) {
    if (token.length < 2 || STOP_WORDS.has(token)) continue;
    if (stem(token) !== target || seen.has(token)) continue;
    seen.add(token);
    forms.push(token);
    if (forms.length >= maxForms) break;
  }
  return forms.length ? forms : [target];
}

/**
 * Terms both notes weigh heavily, by geometric mean of their weights, which
 * penalises terms that are strong in only one of them.
 */
function matchedKeywords(targetVector, otherVector, targetPlain, topN) {
  const shared = [];
  for (const [term, weight] of targetVector) {
    const other = otherVector.get(term);
    if (other === undefined) continue;
    shared.push([term, Math.sqrt(weight * other)]);
  }
  shared.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const keywords = [];
  const seen = new Set();
  for (const [term] of shared.slice(0, topN * 3)) {
    for (const form of recoverSurfaceForms(term, targetPlain)) {
      if (seen.has(form)) continue;
      seen.add(form);
      keywords.push(form);
    }
    if (seen.size >= topN) break;
  }
  return keywords.slice(0, topN);
}

/**
 * Find notes conceptually related to the target.
 *
 * @param {string} targetContent HTML or plain text of the note in focus
 * @param {Record<string, string>} candidates note id -> content
 * @param {{ threshold?: number, maxResults?: number|null, topKeywords?: number }} options
 * @returns {{ linked_note_id: string, similarity_score: number, matched_keywords: string[] }[]}
 */
export function findSemanticLinks(targetContent, candidates, options = {}) {
  const threshold = options.threshold ?? 0.25;
  const maxResults = options.maxResults === undefined ? 50 : options.maxResults;
  const topKeywords = options.topKeywords ?? 8;

  const ids = Object.keys(candidates || {});
  if (ids.length === 0) return [];
  if (!targetContent || !String(targetContent).trim()) return [];

  const documents = [targetContent, ...ids.map((id) => candidates[id])];
  const { vectors } = vectorize(documents);
  // Empty vocabulary: every term was pruned, which is what happens with two
  // documents since anything they share sits at df 1.0.
  if (vectors.length === 0) return [];

  const targetVector = vectors[0];
  const targetPlain = stripHtml(targetContent);

  const results = [];
  ids.forEach((id, index) => {
    const score = cosine(targetVector, vectors[index + 1]);
    if (score < threshold) return;
    results.push({
      linked_note_id: id,
      similarity_score: Math.round(score * 10000) / 10000,
      matched_keywords: matchedKeywords(targetVector, vectors[index + 1], targetPlain, topKeywords),
    });
  });

  results.sort((a, b) => b.similarity_score - a.similarity_score);
  return maxResults === null ? results : results.slice(0, maxResults);
}
