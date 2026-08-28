"""
Tests for the semantic linking pipeline.

Focus: the documented small-corpus limitation, the boilerplate rejection that
max_df exists to provide, and the contract the callers depend on.

Run with:  npm run test:python
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from server.semantic import find_semantic_links
from server.semantic.pipeline import MAX_DF_RATIO, _analyzer

# Fewest candidate notes that can produce a non-zero score. Below this the
# max_df proportion prunes the entire shared vocabulary; see pipeline.py.
MIN_SCORABLE_CANDIDATES = 2

# The sidebar and the graph pass these; kept in sync with NoteViewSidebar.jsx
# and SemanticGraphView.jsx so the tests fail if the pipeline drifts under them.
SIDEBAR_THRESHOLD = 0.25
GRAPH_THRESHOLD = 0.2

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

# A header block of the kind a student repeats across every note. NexoNote has
# no template feature, so boilerplate like this is user-typed prose with no
# structural marker distinguishing it from content.
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


class SmallCorpusLimitation(unittest.TestCase):
    """
    A single candidate note cannot be scored, and that is deliberate.

    With two documents every shared term has a document frequency of 1.0, above
    the max_df proportion, so the shared vocabulary is pruned and the score is
    always 0. Rescuing it would mean admitting terms common to the whole corpus,
    where boilerplate and topic are indistinguishable. These tests pin the
    limitation so it stays a known, documented property rather than a surprise.
    """

    def test_single_related_candidate_is_not_linked(self):
        links = find_semantic_links(
            ML_TARGET, {"a": ML_RELATED}, threshold=SIDEBAR_THRESHOLD
        )
        self.assertEqual(links, [], "a two-note corpus cannot produce a score")

    def test_single_related_candidate_scores_exactly_zero(self):
        links = find_semantic_links(ML_TARGET, {"a": ML_RELATED}, threshold=0.0)
        self.assertEqual(score_for(links, "a"), 0.0)

    def test_even_identical_notes_are_not_linked(self):
        # The starkest form: nothing survives pruning, so the vectorizer has an
        # empty vocabulary and the pipeline returns nothing at all.
        links = find_semantic_links(
            ML_TARGET, {"a": ML_TARGET}, threshold=SIDEBAR_THRESHOLD
        )
        self.assertEqual(links, [])

    def test_boilerplate_cannot_manufacture_a_link_either(self):
        # The upside of the limitation: the two-note case fails closed, so a
        # shared header cannot produce a false positive.
        links = find_semantic_links(
            TEMPLATE + ML_TARGET,
            {"a": TEMPLATE + UNRELATED[1]},
            threshold=SIDEBAR_THRESHOLD,
        )
        self.assertEqual(links, [])

    def test_two_candidates_score_normally(self):
        # One note further on, the proportion is no longer degenerate.
        links = find_semantic_links(
            ML_TARGET, corpus_of(MIN_SCORABLE_CANDIDATES), threshold=0.0
        )
        self.assertGreater(score_for(links, "note-0"), 0.0)
        self.assertEqual(links[0]["linked_note_id"], "note-0")


class BoilerplateRejection(unittest.TestCase):
    """What max_df is for. Relaxing it breaks these."""

    def test_shared_template_does_not_link_unrelated_notes(self):
        candidates = {f"note-{i}": TEMPLATE + doc for i, doc in enumerate(UNRELATED[:5])}
        links = find_semantic_links(
            TEMPLATE + ML_TARGET, candidates, threshold=GRAPH_THRESHOLD
        )
        self.assertEqual(
            links, [], "boilerplate must not create links in a normal corpus"
        )

    def test_template_words_are_not_returned_as_keywords(self):
        candidates = {"note-0": TEMPLATE + ML_RELATED}
        candidates.update(
            {f"note-{i + 1}": TEMPLATE + doc for i, doc in enumerate(UNRELATED[:4])}
        )
        links = find_semantic_links(TEMPLATE + ML_TARGET, candidates, threshold=0.0)
        keywords = set(links[0]["matched_keywords"])
        for template_word in ("smith", "course", "term", "revision", "midterm"):
            self.assertNotIn(template_word, keywords)

    def test_max_df_ratio_is_not_relaxed(self):
        # A guard on the constant itself: at 1.0 unrelated notes sharing a
        # header score around 0.29, above both thresholds.
        self.assertLess(MAX_DF_RATIO, 1.0)


class ScoringParametersDoNotDrift(unittest.TestCase):
    """Pins the vectorizer configuration that every score depends on."""

    @staticmethod
    def reference_scores(target, candidates):
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

    def test_scores_match_the_reference_configuration(self):
        for n_candidates in range(MIN_SCORABLE_CANDIDATES, 8):
            with self.subTest(candidates=n_candidates):
                candidates = corpus_of(n_candidates)
                actual = {
                    link["linked_note_id"]: link["similarity_score"]
                    for link in find_semantic_links(ML_TARGET, candidates, threshold=0.0)
                }
                for note_id, expected in self.reference_scores(
                    ML_TARGET, candidates
                ).items():
                    self.assertAlmostEqual(
                        actual.get(note_id, 0.0),
                        expected,
                        places=4,
                        msg=f"score drifted for {note_id} at {n_candidates} candidates",
                    )


class ScoreConsistencyAsCorpusGrows(unittest.TestCase):
    """The same pair of notes must not jump in score as unrelated notes appear."""

    @classmethod
    def setUpClass(cls):
        cls.sizes = list(range(MIN_SCORABLE_CANDIDATES, len(UNRELATED) + 2))
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

    def test_no_discontinuity_as_the_corpus_grows(self):
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
        for n_candidates in self.sizes:
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

    def test_matched_keywords_are_returned(self):
        links = find_semantic_links(ML_TARGET, corpus_of(4), threshold=0.0)
        keywords = links[0]["matched_keywords"]
        self.assertTrue(keywords)
        self.assertIn("neural", keywords)

    def test_html_is_stripped_before_scoring(self):
        candidates = corpus_of(4)
        wrapped = dict(candidates)
        wrapped["note-0"] = f"<div><em>{candidates['note-0']}</em></div>"
        plain_links = find_semantic_links(ML_TARGET, candidates, threshold=0.0)
        wrapped_links = find_semantic_links(ML_TARGET, wrapped, threshold=0.0)
        self.assertAlmostEqual(
            score_for(plain_links, "note-0"),
            score_for(wrapped_links, "note-0"),
            places=4,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
