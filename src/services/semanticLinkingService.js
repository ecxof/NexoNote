/**
 * Semantic linking service: find conceptually related notes with matched keywords.
 * In Electron: IPC to main process (spawns Python CLI).
 * In browser (localhost): POST to local Python server (run semantic_linking/server.py).
 *
 * Response shape per link:
 *   { linked_note_id: string, similarity_score: number, matched_keywords: string[] }
 */

const SEMANTIC_SERVER_URL = 'http://127.0.0.1:5000';

function hasElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.semanticLinks;
}

/**
 * Find notes that are conceptually related to the given content.
 * @param {string} targetContent - HTML or plain text of the current note
 * @param {{ id: string, content: string }[]} existingNotes - Other notes (id + content only)
 * @param {{ threshold?: number, maxResults?: number, topKeywords?: number }} options
 * @returns {Promise<{ links: Array<{ linked_note_id: string, similarity_score: number, matched_keywords: string[] }>, error?: string }>}
 */
export async function findSemanticLinks(targetContent, existingNotes, options = {}) {
  const threshold = options.threshold ?? 0.25;
  const maxResults = options.maxResults ?? 50;
  const topKeywords = options.topKeywords ?? 8;

  const payload = {
    target_content: targetContent,
    notes: existingNotes,
    threshold,
    max_results: maxResults,
    top_keywords: topKeywords,
  };

  if (hasElectron()) {
    try {
      const result = await window.electronAPI.semanticLinks.find(payload);
      return result?.error ? { links: [], error: result.error } : { links: result?.links ?? [] };
    } catch (e) {
      return { links: [], error: e?.message || 'Semantic linking failed' };
    }
  }

  try {
    const res = await fetch(`${SEMANTIC_SERVER_URL}/find-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { links: [], error: data?.error || `Server error ${res.status}` };
    }
    if (data.error) {
      return { links: [], error: data.error };
    }
    return { links: data.links ?? [] };
  } catch (e) {
    return {
      links: [],
      error: e?.message?.includes('fetch')
        ? 'Semantic linking server not running. Start it with: python -m semantic_linking.server'
        : (e?.message || 'Request failed'),
    };
  }
}
