"""
Semantic linking pipeline: HTML → clean tokens → TF-IDF → cosine similarity.

Steps:
1. Text extraction & cleaning (strip HTML, tokenize, lowercase).
2. Aggressive preprocessing (stop words, domain stop words, lemmatization).
3. TF-IDF vectorization (max_df/min_df to downweight common terms).
4. Cosine similarity between target note and existing notes.
5. Return top related notes above threshold.
"""

import re
from html.parser import HTMLParser

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Optional: use NLTK for stop words and lemmatization (no external model download).
try:
    import nltk
    from nltk.corpus import stopwords as nltk_stopwords
    from nltk.stem import WordNetLemmatizer
    from nltk.tokenize import word_tokenize

    def _ensure_nltk_data():
        for resource in ("punkt", "stopwords", "wordnet"):
            try:
                nltk.download(resource, quiet=True)
            except Exception:
                pass

    _NLTK_AVAILABLE = True
except ImportError:
    _NLTK_AVAILABLE = False


# ─── Domain stop words: common/structural meaning in study/note context ───────
# These are filtered out so linking is based on domain concepts, not generic words.
DOMAIN_STOP_WORDS = frozenset({
    "note", "notes", "summary", "summaries", "exam", "exams", "read", "reading",
    "page", "pages", "conclusion", "conclusions", "study", "studying", "chapter",
    "section", "part", "intro", "introduction", "overview", "example", "examples",
    "definition", "definitions", "reference", "references", "content", "text",
    "document", "documents", "file", "files", "list", "item", "point", "points",
    "topic", "topics", "subject", "subjects", "course", "class", "lecture", "book",
    "article", "paragraph", "heading", "title", "subtitle", "bullet", "number",
    "first", "second", "last", "next", "previous", "see", "also", "etc", "thing",
    "something", "everything", "nothing", "way", "case", "fact", "reason", "result",
    "important", "main", "general", "basic", "simple", "brief", "short", "long",
    "new", "old", "same", "different", "other", "another", "same", "following",
    "above", "below", "here", "there", "today", "tomorrow", "week", "day", "time",
})


class _HTMLTextExtractor(HTMLParser):
    """Strip HTML tags and extract plain text."""

    def __init__(self):
        super().__init__()
        self._chunks = []

    def handle_data(self, data):
        self._chunks.append(data)

    def get_text(self):
        return " ".join(self._chunks)


def strip_html(html_content: str) -> str:
    """
    Remove HTML tags from Rich Text Editor output (TipTap/ProseMirror HTML).
    Returns plain text with normalized whitespace.
    """
    if not html_content or not html_content.strip():
        return ""
    parser = _HTMLTextExtractor()
    try:
        parser.feed(html_content)
        text = parser.get_text()
    except Exception:
        # Fallback: crude tag stripping with regex
        text = re.sub(r"<[^>]+>", " ", html_content)
    # Decode common entities and collapse whitespace
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return " ".join(text.split())


def _tokenize_lower(text: str) -> list[str]:
    """Tokenize and convert to lowercase. Uses NLTK if available, else simple split."""
    text = (text or "").lower().strip()
    if not text:
        return []
    if _NLTK_AVAILABLE:
        return word_tokenize(text)
    return re.findall(r"\b[a-z0-9']+\b", text)


def _get_stop_words() -> set:
    """Union of NLTK English stop words and domain-specific stop words."""
    base = set()
    if _NLTK_AVAILABLE:
        _ensure_nltk_data()
        base = set(nltk_stopwords.words("english"))
    return base | set(DOMAIN_STOP_WORDS)


def _lemmatize_tokens(tokens: list[str], stop: set) -> list[str]:
    """Lemmatize and filter out stop words. Returns list of base-form tokens."""
    if not _NLTK_AVAILABLE:
        return [t for t in tokens if t not in stop]
    _ensure_nltk_data()
    lemmatizer = WordNetLemmatizer()
    out = []
    for t in tokens:
        if t in stop or len(t) < 2:
            continue
        out.append(lemmatizer.lemmatize(lemmatizer.lemmatize(t, pos="v"), pos="n"))
    return out


def _analyzer(text: str) -> list[str]:
    """
    Custom analyzer for TfidfVectorizer: strip HTML, tokenize, lowercase,
    remove stop words (standard + domain), and lemmatize.
    """
    plain = strip_html(text)
    tokens = _tokenize_lower(plain)
    stop = _get_stop_words()
    return _lemmatize_tokens(tokens, stop)


def _recover_surface_forms(lemma: str, plain_text: str, max_forms: int = 3) -> list[str]:
    """
    Find the actual words as they appear in the plain text that map to a given lemma.
    This lets us highlight "backpropagation" or "backpropagations" rather than the
    internal lemma, which may differ from what the user typed.

    Returns a list of unique surface forms (lowercase), de-duped and limited to max_forms.
    """
    if not _NLTK_AVAILABLE:
        return [lemma]

    lemmatizer = WordNetLemmatizer()
    stop = _get_stop_words()
    tokens = _tokenize_lower(plain_text)
    seen = set()
    forms = []
    for t in tokens:
        if t in stop or len(t) < 2:
            continue
        t_lemma = lemmatizer.lemmatize(lemmatizer.lemmatize(t, pos="v"), pos="n")
        if t_lemma == lemma and t not in seen:
            seen.add(t)
            forms.append(t)
            if len(forms) >= max_forms:
                break
    return forms if forms else [lemma]


def _extract_matched_keywords(
    target_vec,          # sparse row vector for the target note
    other_vec,           # sparse row vector for another note
    feature_names: list[str],
    target_plain: str,
    other_plain: str,
    top_n: int = 8,
) -> list[str]:
    """
    Return the top terms that both notes share high TF-IDF weight on.

    Strategy: element-wise minimum of the two TF-IDF vectors, then take the terms
    with the highest combined weight. The minimum ensures only terms that both notes
    score on are kept. Then we map the internal lemmas back to the actual surface forms
    that appear in the target note so the frontend can find and highlight them.
    """
    import numpy as np

    t_arr = target_vec.toarray().ravel()
    o_arr = other_vec.toarray().ravel()

    # Shared weight: use geometric mean (penalises terms that are strong in only one doc).
    shared = np.sqrt(t_arr * o_arr)
    top_indices = shared.argsort()[::-1][:top_n * 3]  # grab extra to allow expansion

    surface_keywords = []
    seen_lemmas = set()
    for idx in top_indices:
        if shared[idx] <= 0:
            break
        lemma = feature_names[idx]
        if lemma in seen_lemmas:
            continue
        seen_lemmas.add(lemma)
        forms = _recover_surface_forms(lemma, target_plain)
        surface_keywords.extend(forms)
        if len(seen_lemmas) >= top_n:
            break

    # De-duplicate while preserving order.
    seen = set()
    unique = []
    for w in surface_keywords:
        if w not in seen:
            seen.add(w)
            unique.append(w)
    return unique[:top_n]


def find_semantic_links(
    target_note_text: str,
    existing_notes_dict: dict[str, str],
    threshold: float = 0.25,
    max_results: int | None = 50,
    top_keywords: int = 8,
) -> list[dict]:
    """
    Find notes that are conceptually related to the target note.

    Parameters
    ----------
    target_note_text : str
        Raw HTML or plain text of the note to find links for (e.g. notes.content).
    existing_notes_dict : dict[str, str]
        Map of note_id -> raw content (HTML or text) for all candidate notes.
        Typically built from the notes table: { row["id"]: row["content"] }.
    threshold : float, default 0.25
        Minimum cosine similarity (0–1) to include a note in results.
    max_results : int or None, default 50
        Maximum number of related notes to return. None = no limit.
    top_keywords : int, default 8
        Maximum number of matched keywords to return per related note.

    Returns
    -------
    list[dict]
        List of dicts sorted by score descending:
        {
            "note_id":          str,
            "similarity_score": float,
            "matched_keywords": list[str],
        }
        Only notes with score >= threshold are included. The target note is excluded.
    """
    if not existing_notes_dict:
        return []

    ids = list(existing_notes_dict.keys())
    corpus = [existing_notes_dict[nid] for nid in ids]

    # Position 0 = target; positions 1..N = existing notes.
    all_docs = [target_note_text] + corpus

    vectorizer = TfidfVectorizer(
        analyzer=_analyzer,
        max_df=0.85,
        min_df=1,
        sublinear_tf=True,
        strip_accents="unicode",
    )

    try:
        X = vectorizer.fit_transform(all_docs)
    except ValueError:
        return []

    feature_names = vectorizer.get_feature_names_out().tolist()

    # Cosine similarity: target is row 0; compare to rows 1..N.
    sims = cosine_similarity(X[0:1], X[1:]).ravel()
    target_plain = strip_html(target_note_text)

    results = []
    for i, (nid, score) in enumerate(zip(ids, sims)):
        if score < threshold:
            continue
        other_plain = strip_html(corpus[i])
        keywords = _extract_matched_keywords(
            X[0],           # target vector (row 0)
            X[i + 1],       # note vector (offset by 1 because row 0 is target)
            feature_names,
            target_plain,
            other_plain,
            top_n=top_keywords,
        )
        results.append({
            "linked_note_id": nid,
            "similarity_score": round(float(score), 4),
            "matched_keywords": keywords,
        })

    results.sort(key=lambda x: -x["similarity_score"])

    if max_results is not None:
        results = results[:max_results]

    return results
