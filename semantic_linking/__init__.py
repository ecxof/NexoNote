"""
NexoNote Semantic Linking – Python backend.

Analyzes note content (HTML from the Rich Text Editor) and finds conceptually
related notes via TF-IDF vectorization and cosine similarity. Links are based
on domain-specific terms (e.g. "backpropagation", "deadlock") and exclude
common/structural words (e.g. "the", "study", "page", "conclusion").

Data contract:
- Input: raw HTML/text from TipTap editor (notes.content in electron/database.cjs).
- existing_notes_dict: { note_id: content_string } for all notes to compare against.
- Output: list of { "note_id": str, "score": float } for notes above threshold.
"""

from .pipeline import find_semantic_links

__all__ = ["find_semantic_links"]
