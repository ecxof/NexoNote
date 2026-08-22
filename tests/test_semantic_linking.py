"""
Tests for the semantic linking pipeline.

Focus: the small-corpus scoring strategy, and the guarantee that introducing
it left scoring for 3+ candidate notes untouched.

Run with:  npm run test:python
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from semantic_linking import find_semantic_links
from semantic_linking.pipeline import (
    MAX_DF_RATIO,
    SMALL_CORPUS_MAX_NOTES,
    _analyzer,
    _max_df_for_corpus,
)

# Two notes on the same topic, and a set of unrelated ones to pad the corpus.
ML_TARGET = "<p>Backpropagation computes gradients for each layer of a neural network.</p>"
ML_RELATED = "<p>Gradient descent updates neural network weights during training.</p>"
UNRELATED = [
    "<p>Deadlock occurs when two processes each wait on a lock the other holds.</p>",
    "<p>Mitochondria produce ATP through oxidative phosphorylation.</p>",
    "<p>Covalent bonds share electron pairs between atoms.</p>",
    "<p>A mutex prevents two threads entering a critical section at once.</p>",
    "<p>Normalisation removes redundancy from relational database schemas.</p>",
    "<p>The Treaty of Westphalia ended the Thirty Years War in 1648.</p>",
]

# A header block of the kind a student repeats across every note.
TEMPLATE = (
    "<h1>Study notes</h1><p>Course: CS101. Instructor: Dr Smith. Term: spring. "
    "Tags: coursework, revision, midterm.</p>"
)


def corpus_of(n_candidates):
    """A candidate dict with the related note first, padded to n_candidates."""
    docs = [ML_RELATED] + UNRELATED[: n_candidates - 1]
    return {f"note-{i}": doc for i, doc in enumerate(docs)}


def score_for(links, note_id):
    for link in links:
        if link["linked_note_id"] == note_id:
            return link["similarity_score"]
    return 0.0


def legacy_scores(target, candidates):
    """
    Scoring exactly as it was before the small-corpus strategy existed, with
    max_df pinned to the 0.85 proportion. Used to prove 3+ corpora are
    unaffected.
    """
    docs = list(candidates.values())
    vectorizer = TfidfVectorizer(
        analyzer=_analyzer,
        max_df=0.85,
        min_df=1,
        sublinear_tf=True,
        strip_accents="unicode",
    )
    matrix = vectorizer.fit_transform([target] + docs)
    sims = cosine_similarity(matrix[0:1], matrix[1:]).ravel()
    return dict(zip(candidates.keys(), (round(float(s), 4) for s in sims)))


class MaxDfSelection(unittest.TestCase):
    """The strategy switch itself, without running the whole pipeline."""

    def test_large_corpus_uses_the_proportion(self):
        for n_candidates in range(SMALL_CORPUS_MAX_NOTES + 1, 40):
            with self.subTest(candidates=n_candidates):
                self.assertEqual(
                    _max_df_for_corpus(n_candidates, n_candidates + 1), MAX_DF_RATIO
                )

    def test_small_corpus_uses_an_absolute_count(self):
        # One candidate: two documents, so a shared term has df == 2 and must
        # survive. Two candidates: df == 3 still gets dropped, matching 0.85.
        self.assertEqual(_max_df_for_corpus(1, 2), 2)
        self.assertEqual(_max_df_for_corpus(2, 3), 2)

    def test_absolute_count_never_drops_a_shared_pair(self):
        # The floor of 2 is what rescues the degenerate case.
        self.assertGreaterEqual(_max_df_for_corpus(1, 2), 2)

    def test_strategies_agree_from_two_candidates_upward(self):
        # floor(0.85 * n) and 0.85 * n must exclude the same integer document
        # frequencies, otherwise the boundary would shift existing scores.
        for n_docs in range(3, 200):
            with self.subTest(n_docs=n_docs):
                kept_by_ratio = {
                    df for df in range(1, n_docs + 1) if df <= MAX_DF_RATIO * n_docs
                }
                kept_by_count = {
                    df
                    for df in range(1, n_docs + 1)
                    if df <= max(2, int(MAX_DF_RATIO * n_docs))
                }
                self.assertEqual(kept_by_ratio, kept_by_count)


class SmallCorpusBehaviour(unittest.TestCase):
    """1-2 candidate notes: the case the proportion could not score."""

    def test_single_related_candidate_is_linked(self):
        links = find_semantic_links(ML_TARGET, {"a": ML_RELATED}, threshold=0.25)
        self.assertEqual(len(links), 1, "a related note must link in a two-note corpus")
        self.assertGreater(links[0]["similarity_score"], 0.25)

    def test_single_unrelated_candidate_is_not_linked(self):
        links = find_semantic_links(ML_TARGET, {"a": UNRELATED[1]}, threshold=0.25)
        self.assertEqual(
            links, [], "unrelated notes must not link just because the corpus is small"
        )

    def test_identical_notes_score_one(self):
        links = find_semantic_links(ML_TARGET, {"a": ML_TARGET}, threshold=0.25)
        self.assertAlmostEqual(links[0]["similarity_score"], 1.0, places=3)

    def test_two_candidates_rank_the_related_note_first(self):
        links = find_semantic_links(
            ML_TARGET, {"a": ML_RELATED, "b": UNRELATED[1]}, threshold=0.0
        )
        self.assertEqual(links[0]["linked_note_id"], "a")

    def test_matched_keywords_are_returned(self):
        links = find_semantic_links(ML_TARGET, {"a": ML_RELATED}, threshold=0.25)
        keywords = links[0]["matched_keywords"]
        self.assertTrue(keywords)
        self.assertIn("neural", keywords)

    def test_shared_template_inflates_small_corpus_scores(self):
        """
        Documents a known limitation rather than desired behaviour.

        With one candidate there are only two documents, so boilerplate and
        topic are indistinguishable: both appear in 100% of the corpus. Two
        unrelated notes that share a header therefore score above the
        threshold. The same pair scores 0 once the corpus is large enough for
        the proportion filter to identify the template, which
        LargeCorpusUnchanged asserts.
        """
        links = find_semantic_links(
            TEMPLATE + ML_TARGET, {"a": TEMPLATE + UNRELATED[1]}, threshold=0.25
        )
        self.assertTrue(links, "expected the documented false positive")
        self.assertGreater(links[0]["similarity_score"], 0.25)


class LargeCorpusUnchanged(unittest.TestCase):
    """3+ candidate notes must score exactly as they did before."""

    def test_scores_match_the_legacy_implementation(self):
        for n_candidates in range(SMALL_CORPUS_MAX_NOTES + 1, 8):
            with self.subTest(candidates=n_candidates):
                candidates = corpus_of(n_candidates)
                actual = {
                    link["linked_note_id"]: link["similarity_score"]
                    for link in find_semantic_links(ML_TARGET, candidates, threshold=0.0)
                }
                expected = legacy_scores(ML_TARGET, candidates)
                for note_id, expected_score in expected.items():
                    self.assertAlmostEqual(
                        actual.get(note_id, 0.0),
                        expected_score,
                        places=4,
                        msg=f"score drifted for {note_id} at {n_candidates} candidates",
                    )

    def test_shared_template_does_not_link_unrelated_notes(self):
        # The counterpart to the small-corpus limitation: with enough notes the
        # template is recognised and contributes nothing.
        candidates = {f"note-{i}": TEMPLATE + doc for i, doc in enumerate(UNRELATED[:5])}
        links = find_semantic_links(TEMPLATE + ML_TARGET, candidates, threshold=0.2)
        self.assertEqual(
            links, [], "boilerplate must not create links in a normal corpus"
        )


class ScoreConsistencyAsCorpusGrows(unittest.TestCase):
    """The same pair of notes must not jump in score as unrelated notes appear."""

    @classmethod
    def setUpClass(cls):
        cls.sizes = list(range(1, len(UNRELATED) + 2))
        cls.scores = []
        for n_candidates in cls.sizes:
            links = find_semantic_links(
                ML_TARGET, corpus_of(n_candidates), threshold=0.0
            )
            cls.scores.append(score_for(links, "note-0"))

    def test_related_pair_scores_above_zero_at_every_size(self):
        for size, score in zip(self.sizes, self.scores):
            with self.subTest(candidates=size):
                self.assertGreater(score, 0.0)

    def test_scores_stay_in_range(self):
        for size, score in zip(self.sizes, self.scores):
            with self.subTest(candidates=size):
                self.assertGreaterEqual(score, 0.0)
                self.assertLessEqual(score, 1.0)

    def test_no_discontinuity_at_the_strategy_boundary(self):
        # Crossing from the small-corpus path to the proportion must not move
        # the score more than ordinary corpus growth does.
        for i in range(1, len(self.scores)):
            delta = abs(self.scores[i] - self.scores[i - 1])
            with self.subTest(step=f"{self.sizes[i - 1]}->{self.sizes[i]}"):
                self.assertLess(
                    delta,
                    0.05,
                    msg=f"score jumped by {delta:.3f} between "
                    f"{self.sizes[i - 1]} and {self.sizes[i]} candidates",
                )

    def test_score_does_not_decrease_as_unrelated_notes_are_added(self):
        # Adding unrelated notes makes the shared terms rarer, so the score
        # should drift up, never down.
        for i in range(1, len(self.scores)):
            with self.subTest(step=f"{self.sizes[i - 1]}->{self.sizes[i]}"):
                self.assertGreaterEqual(self.scores[i], self.scores[i - 1] - 1e-9)

    def test_related_note_outranks_unrelated_at_every_size(self):
        for n_candidates in self.sizes[1:]:
            with self.subTest(candidates=n_candidates):
                links = find_semantic_links(
                    ML_TARGET, corpus_of(n_candidates), threshold=0.0
                )
                self.assertEqual(links[0]["linked_note_id"], "note-0")


class Contract(unittest.TestCase):
    """Behaviour the callers rely on, at any corpus size."""

    def test_empty_corpus_returns_empty(self):
        self.assertEqual(find_semantic_links(ML_TARGET, {}), [])

    def test_empty_target_returns_empty(self):
        self.assertEqual(find_semantic_links("", {"a": ML_RELATED}), [])

    def test_threshold_is_applied(self):
        loose = find_semantic_links(ML_TARGET, corpus_of(4), threshold=0.0)
        strict = find_semantic_links(ML_TARGET, corpus_of(4), threshold=0.99)
        self.assertTrue(loose)
        self.assertEqual(strict, [])

    def test_max_results_is_applied(self):
        links = find_semantic_links(
            ML_TARGET, corpus_of(5), threshold=0.0, max_results=1
        )
        self.assertLessEqual(len(links), 1)

    def test_results_are_sorted_by_score_descending(self):
        links = find_semantic_links(ML_TARGET, corpus_of(6), threshold=0.0)
        scores = [link["similarity_score"] for link in links]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_html_is_stripped_before_scoring(self):
        plain = find_semantic_links(ML_TARGET, {"a": ML_RELATED}, threshold=0.0)
        wrapped = find_semantic_links(
            ML_TARGET,
            {"a": f"<div><em>{ML_RELATED}</em></div>"},
            threshold=0.0,
        )
        self.assertAlmostEqual(
            plain[0]["similarity_score"], wrapped[0]["similarity_score"], places=4
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
