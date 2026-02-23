/**
 * TipTap mark extension: SemanticLink.
 *
 * Wraps matched keywords in a styled, clickable span that routes to the linked note.
 * The mark stores:
 *   - data-note-id  : the target note's ID
 *   - data-keyword  : the matched word (for reference / removal)
 *
 * Clicking a highlighted word calls onSemanticLinkClick(noteId) which is injected
 * via the editor's storage object (set after editor creation).
 */
import { Mark, mergeAttributes } from '@tiptap/react';

export const SemanticLink = Mark.create({
  name: 'semanticLink',

  priority: 1001, // higher than the built-in Link so it takes precedence

  keepOnSplit: false,
  excludes: '',    // allow coexisting with other marks (bold, highlight, etc.)

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-note-id'),
        renderHTML: (attrs) => attrs.noteId ? { 'data-note-id': attrs.noteId } : {},
      },
      keyword: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-keyword'),
        renderHTML: (attrs) => attrs.keyword ? { 'data-keyword': attrs.keyword } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-note-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'semantic-link' }, HTMLAttributes), 0];
  },

  addNodeView() {
    return null; // use default renderHTML; clicks handled via event delegation
  },
});
