# Semantic Linking – Python Backend

This package implements **semantic linking** for NexoNote: it analyzes note content (HTML from the Rich Text Editor) and finds conceptually related notes using TF-IDF and cosine similarity.

## Data source

- Note content is stored in the **`notes.content`** column (SQLite) or equivalent in the app. See `electron/database.cjs` for the schema. Content is HTML produced by the TipTap editor.

## Pipeline (overview)

1. **Text extraction & cleaning** – Strip HTML tags, tokenize, lowercase.
2. **Preprocessing** – Remove standard English stop words and a custom _domain stop word_ list (e.g. "note", "summary", "exam", "page", "conclusion") so links are based on domain concepts. Lemmatization reduces words to base form.
3. **Vectorization** – `TfidfVectorizer` with `max_df=0.85` and `min_df=1` so terms that appear in too many notes are downweighted or ignored.
4. **Similarity** – Cosine similarity between the target note and all candidate notes.
5. **Output** – `find_semantic_links(target_note_text, existing_notes_dict, threshold=0.25)` returns a list of `{"note_id", "score"}` for notes above the threshold.

## Setup

```bash
npm run setup:python
```

From the project root. This creates a `.venv`, installs `requirements.txt` into it, downloads the NLTK corpora (`punkt`, `punkt_tab`, `stopwords`, `wordnet`), and smoke-tests the pipeline. Rerunning is safe; `-- --force` rebuilds the virtualenv.

`punkt_tab` matters: `word_tokenize` requires it on NLTK 3.9+, where `punkt` alone is no longer enough.

To install by hand instead, use any Python and point the app at it with `NEXONOTE_SEMANTIC_PYTHON`:

```bash
pip install -r semantic_linking/requirements.txt
python -m nltk.downloader punkt punkt_tab stopwords wordnet
```

## Usage

```python
from semantic_linking import find_semantic_links

# target_note_text: HTML or plain text of the note you're viewing
# existing_notes_dict: { note_id: content } for all other notes (e.g. from DB)
existing = {
    "uuid-1": "<p>Backpropagation computes gradients...</p>",
    "uuid-2": "<p>Deadlock occurs when two processes...</p>",
}
target = "<p>Gradient descent and backpropagation are used in neural networks.</p>"

links = find_semantic_links(target, existing, threshold=0.25)
# e.g. [{"note_id": "uuid-1", "score": 0.42}, ...]
```

## Running in the live app

### Browser

`npm run dev` starts Vite and the semantic linking server together, so no second terminal is needed:

```bash
npm run dev
```

The server runs at **http://127.0.0.1:5000**. Open a note and the left sidebar shows **Related notes** with clickable links to similar notes.

If Python is not set up, the server is skipped with a note explaining why and Vite still starts — the rest of the app works without it. Use `npm run dev:vite` to start Vite alone.

To run the server by itself:

```bash
python -m semantic_linking.server
```

### Electron

No server needed. The main process spawns the Python CLI (`semantic_linking/cli.py`) when the sidebar requests related notes.

Electron picks the interpreter by probing candidates in order and keeping the first one that can `import sklearn, nltk`:

1. `$NEXONOTE_SEMANTIC_PYTHON`, if set (full path to a Python executable)
2. `.venv/Scripts/python.exe` (Windows) or `.venv/bin/python`, if a project-local virtualenv exists
3. `py -3` on Windows, `python3` elsewhere
4. `python`

If no candidate has the dependencies, the sidebar shows which interpreters were tried and why each was rejected, along with the command to fix it. Running `npm run setup:python` and reopening the sidebar is enough — no app restart needed.

## Tests

```bash
npm run test:python
```

Runs `tests/test_semantic_linking.py` with the same interpreter the app uses. The suite covers the contract the callers depend on plus three properties worth keeping:

- **The two-note limitation stays pinned** — `SmallCorpusLimitation` asserts that a single candidate note yields no link, so the behaviour below is a known property rather than a regression someone rediscovers.
- **Boilerplate is rejected** — unrelated notes sharing a header block produce no links, and template words never appear in `matched_keywords`. These are what `max_df` buys; they fail if it is relaxed.
- **Scores stay continuous as the corpus grows** — the same pair of notes never jumps by more than 0.05 between consecutive corpus sizes, never decreases as unrelated notes are added, and the related note keeps its rank.

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

## Dependencies

- **scikit-learn** – TF-IDF and cosine similarity
- **nltk** – Tokenization, stop words, lemmatization (WordNet)

Alternative: the same pipeline can be implemented with **spaCy** (e.g. `en_core_web_sm`) for lemmatization and stop words; the current implementation uses NLTK to avoid a separate model download step.
