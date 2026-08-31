# Semantic Linking

Semantic linking suggests **conceptually related notes** based on the content of the
note you are reading. It uses standard IR techniques, so links are driven by domain
concepts (e.g. "backpropagation", "deadlock") rather than by common or structural
words (e.g. "the", "study", "page", "conclusion").

It surfaces in three places: the **Related notes** panel in the note view's left
sidebar, **keyword highlights** inside the editor body, and the force-directed
**semantic graph** view.

It runs in the app itself. There is nothing to install and nothing to start.

## Where it lives

| Piece | Location |
| --- | --- |
| Pipeline | `src/features/semantic/tfidfPipeline.js` |
| Stop words | `src/features/semantic/stopWords.js` |
| Caller-facing service | `src/features/semantic/semanticLinkingService.js` |
| Tests | `scripts/test-semantic-js.mjs` (`npm run test:semantic`) |

## Data source

- Note content is stored in the **`notes.content`** column (SQLite) or equivalent in the app. See `electron/database.cjs` for the schema. Content is HTML produced by the TipTap editor.

## Pipeline (overview)

1. **Text extraction** - strip HTML tags and entities, collapse whitespace.
2. **Preprocessing** - lowercase, tokenize (keeping internal hyphens so
   "back-propagation" stays one term), drop stop words, and stem with Porter.
   Stop words are NLTK's 198 English words plus 92 domain words common to study
   notes, so links reflect concepts rather than note scaffolding.
3. **Vectorization** - TF-IDF exactly as scikit-learn computes it: sublinear tf
   (`1 + ln(count)`), smooth idf (`ln((1 + n) / (1 + df)) + 1`), L2 normalization,
   and `max_df = 0.85` term pruning.
4. **Similarity** - cosine similarity, a dot product of unit vectors.
5. **Output** - `findSemanticLinks(targetContent, candidates, options)` returns
   `{ linked_note_id, similarity_score, matched_keywords }`, sorted by score.

Matched keywords are the terms both notes weigh heavily, by geometric mean, mapped
back to the words that actually appear in the note so highlights show what the user
wrote rather than a stem.

## Usage

```js
import { findSemanticLinks } from '@/features/semantic/tfidfPipeline';

const links = findSemanticLinks(
  '<p>Gradient descent and backpropagation train neural networks.</p>',
  {
    'uuid-1': '<p>Backpropagation computes gradients for each layer.</p>',
    'uuid-2': '<p>Deadlock occurs when two processes wait.</p>',
  },
  { threshold: 0.25, maxResults: 20, topKeywords: 8 },
);
// [{ linked_note_id: 'uuid-1', similarity_score: 0.5363,
//    matched_keywords: ['neural', 'backpropagation', 'gradient', 'networks'] }]
```

## Tests

```bash
npm run test:semantic
```

21 tests covering the two-note limitation below, boilerplate rejection, score
continuity as the corpus grows, and the contract the callers depend on.

## History

This ran in Python until it was ported. The pipeline used scikit-learn and NLTK,
spawned as a CLI under Electron or reached over HTTP in browser dev. That made a
working feature conditional on the user having Python plus roughly 290 MB of
scientific packages and NLTK corpora, and it did not work in a packaged build at
all - the installer shipped no Python.

The port reproduces the scoring maths exactly and reuses the same stop word lists.
Two steps could not be reproduced without their data files: NLTK's `word_tokenize`
needs the 47 MB punkt models, and WordNet lemmatization needs an 11 MB corpus, so
the port uses a regex tokenizer and a Porter stemmer. Measured over six corpora and
18 note pairs, 13 pairs scored identically; the largest divergence was 0.2434 on
irregular plurals (WordNet maps "hypotheses" to "hypothesis", Porter does not), and
the single ranking difference sat at 0.1358, below both the 0.25 sidebar and 0.20
graph thresholds, so neither implementation would display it.

## Limitations

### Related notes is always empty when you have exactly two notes

With a target note and a single candidate there are only two documents, so every term they share has a document frequency of 1.0. That is above the `max_df=0.85` cut-off, the whole shared vocabulary is pruned, and the similarity is exactly 0 — however alike the notes are. Two identical notes score 0 too. Measured against a related pair:

| Notes in the app | Score for the related pair |
| --- | --- |
| 2 | 0.000 |
| 3 | 0.333 |
| 4 | 0.349 |
| 5 | 0.360 |
| 6 | 0.367 |

From three notes onward the filter behaves normally: a term shared by two of three documents has a ratio of 0.67 and survives.

**This is deliberate, not an oversight.** `max_df` is the only thing preventing shared boilerplate from linking every note to every other one — TF-IDF will not do it alone, because with smoothing a term present in every document still carries an idf of 1.0 rather than 0. Rescuing the two-note case means admitting terms common to the entire corpus, and at that size boilerplate and topic are indistinguishable: both appear in 100% of the documents. The rescued score would be confidently wrong rather than merely absent, and an empty panel is the more honest cold-start failure.

Related: NexoNote has no note templates, and the title and tags are stored in separate columns rather than in `notes.content`. Boilerplate is therefore user-typed prose with no structural marker, so it cannot be stripped before scoring — only identified statistically, which is exactly what `max_df` does and exactly what a two-document corpus cannot support.

### The same pair of notes changes score as the corpus grows

Visible in the table above: the related pair moves from 0.333 to 0.367 as unrelated notes are added. IDF is computed over the whole corpus, so a term's weight depends on how many notes exist. The percentage shown in the sidebar drifts upward over time for an unchanged pair of notes. The drift is bounded and monotonic — `ScoreConsistencyAsCorpusGrows` pins both — but it is not a bug report.
