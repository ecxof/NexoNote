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

## Dependencies

- **scikit-learn** – TF-IDF and cosine similarity
- **nltk** – Tokenization, stop words, lemmatization (WordNet)

Alternative: the same pipeline can be implemented with **spaCy** (e.g. `en_core_web_sm`) for lemmatization and stop words; the current implementation uses NLTK to avoid a separate model download step.
