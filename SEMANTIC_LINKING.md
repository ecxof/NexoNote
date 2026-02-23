# Semantic Linking

Semantic linking automatically suggests **conceptually related notes** based on the content of the current note. The backend is implemented in Python and uses standard NLP and IR techniques so that links are driven by **domain-specific concepts** (e.g. "backpropagation", "deadlock") and **not** by common or structural words (e.g. "the", "study", "page", "conclusion").

## Where it lives

- **Code**: `semantic_linking/` (Python package at project root)
- **Data**: Note content comes from the Rich Text Editor and is stored in **`notes.content`** (see `electron/database.cjs`). Content is HTML from TipTap.

## Pipeline (summary)

1. **Text extraction & cleaning** – Strip HTML, tokenize, lowercase.
2. **Preprocessing** – Remove standard English stop words and a custom *domain stop word* list; lemmatize.
3. **Vectorization** – TF-IDF with `max_df` / `min_df` so very common terms are downweighted.
4. **Similarity** – Cosine similarity between the target note and all other notes.
5. **Output** – `find_semantic_links(target_note_text, existing_notes_dict, threshold=0.25)` returns a list of `{"note_id", "score"}`.

## Setup and usage

See **[semantic_linking/README.md](semantic_linking/README.md)** for:

- Installing dependencies (`pip install -r semantic_linking/requirements.txt`)
- Downloading NLTK data (punkt, stopwords, wordnet)
- Example usage of `find_semantic_links`
- How the Electron app can call this backend (e.g. spawn Python, pass JSON)

## Tech stack (backend)

- **scikit-learn** – `TfidfVectorizer`, `cosine_similarity`
- **NLTK** – tokenization, stop words, WordNet lemmatization

No changes to `src/` are required for the backend contract; the frontend can stay unchanged until the team is ready to surface links in the UI.
