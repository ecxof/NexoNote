/**
 * Semantic linking service: find conceptually related notes with matched keywords.
 *
 * Scoring runs in the app itself (see tfidfPipeline.js). It previously ran in
 * Python - spawned as a CLI under Electron, or reached over HTTP in the browser
 * - which meant related notes only worked where the user had Python plus
 * scikit-learn, NLTK and its corpora installed, and did not work at all in a
 * packaged build. TF-IDF over a few hundred notes needs none of that.
 *
 * Response shape per link:
 *   { linked_note_id: string, similarity_score: number, matched_keywords: string[] }
 */

import { findSemanticLinks as computeLinks } from './tfidfPipeline.js';

/**
 * Fewest notes in the app before any link can be scored.
 *
 * The pipeline prunes terms whose document frequency exceeds max_df=0.85. With
 * a target note and a single candidate there are only two documents, so every
 * term they share sits at 1.0 and is pruned, and the score is exactly 0 however
 * alike the notes are — identical notes included. Below this count the work is
 * skipped, because the answer is already known.
 *
 * See the Limitations section of docs/semantic-linking.md.
 */
export const MIN_NOTES_FOR_LINKS = 3;

/**
 * Find notes that are conceptually related to the given content.
 *
 * Kept async, and kept returning { links, error }, so callers are unchanged
 * from when this crossed a process boundary.
 *
 * @param {string} targetContent - HTML or plain text of the current note
 * @param {{ id: string, content: string }[]} existingNotes - Other notes (id + content only)
 * @param {{ threshold?: number, maxResults?: number, topKeywords?: number }} options
 * @returns {Promise<{ links: Array<{ linked_note_id: string, similarity_score: number, matched_keywords: string[] }>, error?: string }>}
 */
export async function findSemanticLinks(targetContent, existingNotes, options = {}) {
  try {
    const candidates = {};
    for (const note of existingNotes || []) {
      if (note?.id) candidates[note.id] = note.content ?? '';
    }

    const links = computeLinks(targetContent, candidates, {
      threshold: options.threshold ?? 0.25,
      maxResults: options.maxResults ?? 50,
      topKeywords: options.topKeywords ?? 8,
    });
    return { links };
  } catch (e) {
    return { links: [], error: e?.message || 'Semantic linking failed' };
  }
}
