# Semantic Linking – Python Backend

This package implements **semantic linking** for NexoNote: it analyzes note content (HTML from the Rich Text Editor) and finds conceptually related notes using TF-IDF and cosine similarity.

## Data source

- Note content is stored in the **`notes.content`** column (SQLite) or equivalent in the app. See `electron/database.cjs` for the schema. Content is HTML produced by the TipTap editor.

## Pipeline (overview)

1. **Text extraction & cleaning** – Strip HTML tags, tokenize, lowercase.
2. **Preprocessing** – Remove standard English stop words and a custom *domain stop word* list (e.g. "note", "summary", "exam", "page", "conclusion") so links are based on domain concepts. Lemmatization reduces words to base form.
3. **Vectorization** – `TfidfVectorizer` with `max_df=0.85` and `min_df=1` so terms that appear in too many notes are downweighted or ignored.
4. **Similarity** – Cosine similarity between the target note and all candidate notes.
5. **Output** – `find_semantic_links(target_note_text, existing_notes_dict, threshold=0.25)` returns a list of `{"note_id", "score"}` for notes above the threshold.

## Setup

```bash
# From project root
pip install -r semantic_linking/requirements.txt

# First run: download NLTK data (punkt, punkt_tab, stopwords, wordnet, omw-1.4)
python -m nltk.downloader punkt punkt_tab stopwords wordnet omw-1.4
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

### Browser (localhost:5173)

Start the Python HTTP server so the React app can request related notes:

```bash
# From project root, in a separate terminal
pip install -r semantic_linking/requirements.txt
python -m nltk.downloader punkt punkt_tab stopwords wordnet omw-1.4   # first time only
python -m semantic_linking.server
```

The server runs at **http://127.0.0.1:5000**. Then run the app with `npm run dev` and open a note; the left sidebar shows **Related notes** with clickable links to similar notes.

### Electron

No server needed. The main process spawns the Python CLI (`semantic_linking/cli.py`) when the sidebar requests related notes. Ensure Python is on your PATH and the project has the `semantic_linking` package and dependencies installed.

## Dependencies

- **scikit-learn** – TF-IDF and cosine similarity
- **nltk** – Tokenization, stop words, lemmatization (WordNet)

Alternative: the same pipeline can be implemented with **spaCy** (e.g. `en_core_web_sm`) for lemmatization and stop words; the current implementation uses NLTK to avoid a separate model download step.
