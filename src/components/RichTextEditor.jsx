/**
 * Rich text editor using TipTap.
 * Toolbar: undo/redo, headings H1–H4, blockquote, bold, italic, underline, strike,
 * highlight (colors), code, code block, link, subscript, superscript, alignment,
 * bullet/numbered/task lists, image (URL or file).
 * Content is stored as HTML; we report changes via onContentChange(html).
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { SemanticLink } from '../extensions/SemanticLink';
import { useEffect, useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  Undo2,
  Redo2,
  Type,
  Quote,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Eraser,
  Code,
  FileCode,
  Link as LinkIcon,
  ExternalLink,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListTodo,
  ImagePlus,
  Upload,
  ChevronDown,
} from 'lucide-react';

const HIGHLIGHT_COLORS = [
  { name: 'Green', value: '#6FB38A' },
  { name: 'Blue', value: '#7FA9C4' },
  { name: 'Red', value: '#A15A5A' },
  { name: 'Purple', value: '#7B5FA0' },
  { name: 'Yellow', value: '#A89A3A' },
];

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: false,
    // Disable underline if StarterKit includes it to avoid duplicate
    underline: false,
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
  }),
  Subscript,
  Superscript,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right', 'justify'],
  }),
  Image.configure({
    inline: false,
    allowBase64: true,
  }),
  Highlight.configure({ multicolor: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  SemanticLink,
];

function getHeadingPositions(editor) {
  if (!editor?.state?.doc) return [];
  const positions = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') positions.push(pos);
  });
  return positions;
}

function getSelectionBox(editor) {
  if (!editor?.view) return null;
  const { from, to } = editor.state.selection;
  if (from === to) return null;
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
  return {
    top: Math.min(start.top, end.top),
    bottom: Math.max(start.bottom, end.bottom),
    left: Math.min(start.left, end.left),
    right: Math.max(start.right, end.right),
  };
}

const RichTextEditor = forwardRef(function RichTextEditor({
  initialContent = '',
  onContentChange,
  editable = true,
  fontSize = 'medium',
  className = '',
  showToolbar = true,
  onSemanticLinkClick,
}, ref) {
  const editor = useEditor({
    extensions,
    content: initialContent || '<p></p>',
    editable,
    editorProps: {
      attributes: {
        class: `rich-text-editor__body rich-text-editor__body--${fontSize}`,
      },
    },
  });

  const [selectionToolbar, setSelectionToolbar] = useState({ show: false, top: 0, left: 0 });
  const [lastHighlightColor, setLastHighlightColor] = useState(HIGHLIGHT_COLORS[0]?.value ?? '#6FB38A');
  const contentRef = useRef(null);
  const onSemanticLinkClickRef = useRef(onSemanticLinkClick);
  useEffect(() => { onSemanticLinkClickRef.current = onSemanticLinkClick; }, [onSemanticLinkClick]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e) => {
      const span = e.target.closest('span[data-note-id]');
      if (!span) return;
      e.preventDefault();
      e.stopPropagation();
      const noteId = span.getAttribute('data-note-id');
      if (noteId) onSemanticLinkClickRef.current?.(noteId);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, []);

  const updateSelectionToolbar = useCallback(() => {
    if (!editor) return;
    const box = getSelectionBox(editor);
    const container = contentRef.current;
    if (!box || !container) {
      setSelectionToolbar((s) => (s.show ? { ...s, show: false } : s));
      return;
    }
    const rect = container.getBoundingClientRect();
    const padding = 8;
    let top = box.bottom - rect.top + container.scrollTop + padding;
    let left = (box.left + box.right) / 2 - rect.left + container.scrollLeft;
    const toolbarMaxWidth = 320;
    const half = toolbarMaxWidth / 2;
    left = Math.max(half, Math.min(container.scrollWidth - half, left));
    setSelectionToolbar({ show: true, top, left });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => updateSelectionToolbar();
    editor.on('selectionUpdate', onSelectionUpdate);
    return () => editor.off('selectionUpdate', onSelectionUpdate);
  }, [editor, updateSelectionToolbar]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      if (editor && selectionToolbar.show) updateSelectionToolbar();
    };
    el.addEventListener('scroll', onScroll, true);
    return () => el.removeEventListener('scroll', onScroll, true);
  }, [editor, selectionToolbar.show, updateSelectionToolbar]);

  useImperativeHandle(ref, () => ({
    scrollToHeadingIndex(index) {
      if (!editor) return;
      const positions = getHeadingPositions(editor);
      const pos = positions[index];
      if (pos == null) return;
      const startInside = pos + 1;
      editor.chain().focus().setTextSelection(startInside).scrollIntoView().run();
    },

    /**
     * Apply semantic-link marks for a set of related notes.
     * @param {Array<{ linked_note_id: string, similarity_score: number, matched_keywords: string[] }>} links
     */
    applySemanticLinks(links) {
      if (!editor) return;

      editor.chain().focus().selectAll().unsetMark('semanticLink').run();
      editor.commands.setTextSelection({ from: 0, to: 0 });

      if (!links?.length) return;

      const { state } = editor;
      const { doc } = state;

      const textRanges = [];
      doc.descendants((node, pos) => {
        if (node.isText) textRanges.push({ text: node.text, pos });
      });

      const targets = [];
      for (const link of links) {
        const nid = link.linked_note_id ?? link.note_id;
        for (const kw of (link.matched_keywords ?? [])) {
          targets.push({ keyword: kw.toLowerCase(), noteId: nid });
        }
      }

      const chain = editor.chain();
      for (const { text, pos } of textRanges) {
        const lower = text.toLowerCase();
        for (const { keyword, noteId } of targets) {
          if (!keyword) continue;
          let searchFrom = 0;
          while (searchFrom < lower.length) {
            const idx = lower.indexOf(keyword, searchFrom);
            if (idx === -1) break;
            const before = idx === 0 ? '' : lower[idx - 1];
            const after = idx + keyword.length >= lower.length ? '' : lower[idx + keyword.length];
            const isBoundaryBefore = !before || /[^a-z0-9]/.test(before);
            const isBoundaryAfter = !after || /[^a-z0-9]/.test(after);
            if (isBoundaryBefore && isBoundaryAfter) {
              const from = pos + idx;
              const to = pos + idx + keyword.length;
              chain.setTextSelection({ from, to }).setMark('semanticLink', { noteId, keyword });
            }
            searchFrom = idx + keyword.length;
          }
        }
      }
      chain.setTextSelection({ from: 0, to: 0 }).run();
    },

    /** Remove all semantic-link marks from the document. */
    clearSemanticLinks() {
      if (!editor) return;
      editor.chain().focus().selectAll().unsetMark('semanticLink').run();
      editor.commands.setTextSelection({ from: 0, to: 0 });
    },
  }), [editor]);

  useEffect(() => {
    if (!editor || !onContentChange) return;
    const handler = () => onContentChange(editor.getHTML());
    editor.on('update', handler);
    return () => editor.off('update', handler);
  }, [editor, onContentChange]);

  return (
    <div className={`rich-text-editor ${className}`}>
      {showToolbar && (
        <EditorToolbar
          editor={editor}
          lastHighlightColor={lastHighlightColor}
          onHighlightColorChange={setLastHighlightColor}
        />
      )}
      <div ref={contentRef} className="rich-text-editor-content">
        <EditorContent editor={editor} />
        {selectionToolbar.show && editor && (
          <SelectionFloatingToolbar
            editor={editor}
            top={selectionToolbar.top}
            left={selectionToolbar.left}
            lastHighlightColor={lastHighlightColor}
            onHighlightColorChange={setLastHighlightColor}
          />
        )}
      </div>
    </div>
  );
});

export default RichTextEditor;

function SelectionFloatingToolbar({ editor, top, left, lastHighlightColor, onHighlightColorChange }) {
  const [highlightDropdownOpen, setHighlightDropdownOpen] = useState(false);
  if (!editor) return null;
  return (
    <div
      className="rich-text-editor-selection-toolbar"
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
      role="toolbar"
      aria-label="Format selection"
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="rich-text-editor-selection-toolbar-caret" aria-hidden />
      <div className="rich-text-editor-selection-toolbar-inner">
        <button
          type="button"
          className="rich-text-editor-selection-toolbar-btn"
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          aria-label="Bold"
          data-active={editor.isActive('bold')}
        >
          <Bold size={17} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="rich-text-editor-selection-toolbar-btn"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          aria-label="Italic"
          data-active={editor.isActive('italic')}
        >
          <Italic size={17} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="rich-text-editor-selection-toolbar-btn"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
          aria-label="Underline"
          data-active={editor.isActive('underline')}
        >
          <UnderlineIcon size={17} strokeWidth={2} />
        </button>
        <div className="rich-text-editor-selection-toolbar-highlight-wrap">
          <button
            type="button"
            className="rich-text-editor-selection-toolbar-btn"
            onClick={() => editor.chain().focus().toggleHighlight({ color: lastHighlightColor }).run()}
            title="Highlight"
            aria-label="Highlight with current color"
            data-active={editor.isActive('highlight')}
          >
            <span className="rich-text-editor-selection-toolbar-highlight-icon">
              <Highlighter size={17} strokeWidth={2} />
              <span className="rich-text-editor-selection-toolbar-color-strip" style={{ backgroundColor: lastHighlightColor }} aria-hidden />
            </span>
          </button>
          <button
            type="button"
            className="rich-text-editor-selection-toolbar-btn rich-text-editor-selection-toolbar-highlight-arrow"
            onClick={() => setHighlightDropdownOpen((o) => !o)}
            aria-label="Highlight color options"
            aria-haspopup="true"
            aria-expanded={highlightDropdownOpen}
          >
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          {highlightDropdownOpen && (
            <>
              <div className="rich-text-editor-selection-toolbar-dropdown-backdrop" onClick={() => setHighlightDropdownOpen(false)} aria-hidden />
              <div className="rich-text-editor-selection-toolbar-highlight-dropdown" role="menu">
                {HIGHLIGHT_COLORS.map(({ name, value }) => (
                  <button
                    key={value}
                    type="button"
                    className="rich-text-editor-selection-toolbar-swatch"
                    role="menuitem"
                    data-active={editor.isActive('highlight', { color: value })}
                    onClick={() => {
                      onHighlightColorChange?.(value);
                      editor.chain().focus().toggleHighlight({ color: value }).run();
                      setHighlightDropdownOpen(false);
                    }}
                    title={name}
                    aria-label={name}
                  >
                    <span className="toolbar-swatch" style={{ backgroundColor: value }} />
                  </button>
                ))}
                <button
                  type="button"
                  className="rich-text-editor-selection-toolbar-remove-highlight"
                  role="menuitem"
                  title="Remove highlight"
                  aria-label="Remove highlight"
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setHighlightDropdownOpen(false);
                  }}
                >
                  <Eraser size={14} strokeWidth={2} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ icon: Icon, active, disabled, onClick, title, ariaLabel }) {
  return (
    <button
      type="button"
      className="toolbar-btn"
      onClick={onClick}
      disabled={disabled}
      data-active={active}
      title={title}
      aria-label={ariaLabel}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  );
}

function EditorToolbar({ editor, lastHighlightColor, onHighlightColorChange }) {
  const [headingOpen, setHeadingOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [highlightOpen, setHighlightOpen] = useState(false);
  const imageFileInputRef = useRef(null);

  const openLinkPopup = useCallback(() => {
    const attrs = editor.getAttributes('link');
    setLinkUrl(attrs.href || '');
    setLinkOpen(true);
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
    setLinkOpen(false);
  }, [editor, linkUrl]);

  const insertImage = useCallback((src) => {
    if (!editor || !src) return;
    editor.chain().focus().setImage({ src }).run();
    setImageUrl('');
    setImageOpen(false);
  }, [editor]);

  const insertImageFromUrl = useCallback(() => {
    if (imageUrl.trim()) insertImage(imageUrl.trim());
  }, [editor, imageUrl, insertImage]);

  const handleImageFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => { insertImage(reader.result); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor, insertImage]);

  if (!editor) return null;

  const currentAlign = editor.getAttributes('paragraph').textAlign || editor.getAttributes('heading').textAlign || 'left';

  return (
    <div className="rich-text-editor-toolbar">
      {/* Undo / Redo */}
      <div className="toolbar-group">
        <ToolbarBtn
          icon={Undo2}
          active={false}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
          ariaLabel="Undo"
        />
        <ToolbarBtn
          icon={Redo2}
          active={false}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Shift+Z)"
          ariaLabel="Redo"
        />
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Heading dropdown */}
      <div className="toolbar-group toolbar-dropdown-wrap">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-dropdown"
          onClick={() => setHeadingOpen((o) => !o)}
          data-active={editor.isActive('heading')}
          title="Heading"
          aria-label="Heading"
          aria-haspopup="true"
          aria-expanded={headingOpen}
        >
          <Type size={18} strokeWidth={2} />
        </button>
        {headingOpen && (
          <>
            <div className="toolbar-dropdown-backdrop" onClick={() => setHeadingOpen(false)} aria-hidden="true" />
            <div className="toolbar-dropdown" role="menu">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className="toolbar-dropdown-item"
                  role="menuitem"
                  data-active={editor.isActive('heading', { level })}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level }).run();
                    setHeadingOpen(false);
                  }}
                >
                  Heading {level}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Block quote */}
      <div className="toolbar-group">
        <ToolbarBtn
          icon={Quote}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Block quote"
          ariaLabel="Block quote"
        />
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Text formatting */}
      <div className="toolbar-group">
        <ToolbarBtn
          icon={Bold}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
          ariaLabel="Bold"
        />
        <ToolbarBtn
          icon={Italic}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
          ariaLabel="Italic"
        />
        <ToolbarBtn
          icon={UnderlineIcon}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
          ariaLabel="Underline"
        />
        <ToolbarBtn
          icon={Strikethrough}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
          ariaLabel="Strikethrough"
        />
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Highlight: split – icon applies last color, arrow opens dropdown */}
      <div className="toolbar-group toolbar-dropdown-wrap toolbar-highlight-split">
        <button
          type="button"
          className="toolbar-btn toolbar-highlight-apply"
          onClick={() => editor.chain().focus().toggleHighlight({ color: lastHighlightColor }).run()}
          data-active={editor.isActive('highlight')}
          title="Highlight"
          aria-label="Highlight with current color"
        >
          <span className="toolbar-highlight-icon-wrap">
            <Highlighter size={18} strokeWidth={2} />
            <span className="toolbar-highlight-color-strip" style={{ backgroundColor: lastHighlightColor }} aria-hidden />
          </span>
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-highlight-arrow"
          onClick={() => setHighlightOpen((o) => !o)}
          aria-label="Highlight color options"
          aria-haspopup="true"
          aria-expanded={highlightOpen}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
        {highlightOpen && (
          <>
            <div className="toolbar-dropdown-backdrop" onClick={() => setHighlightOpen(false)} aria-hidden="true" />
            <div className="toolbar-dropdown toolbar-dropdown-highlight" role="menu">
              {HIGHLIGHT_COLORS.map(({ name, value }) => (
                <button
                  key={value}
                  type="button"
                  className="toolbar-btn toolbar-highlight-swatch-btn"
                  role="menuitem"
                  data-active={editor.isActive('highlight', { color: value })}
                  onClick={() => {
                    onHighlightColorChange?.(value);
                    editor.chain().focus().toggleHighlight({ color: value }).run();
                    setHighlightOpen(false);
                  }}
                  title={name}
                  aria-label={name}
                >
                  <span className="toolbar-swatch" style={{ backgroundColor: value }} />
                </button>
              ))}
              <button
                type="button"
                className="toolbar-btn toolbar-highlight-remove-btn"
                role="menuitem"
                title="Remove highlight"
                aria-label="Remove highlight"
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setHighlightOpen(false);
                }}
              >
                <Eraser size={18} strokeWidth={2} />
              </button>
            </div>
          </>
        )}
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Code */}
      <div className="toolbar-group">
        <ToolbarBtn
          icon={Code}
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
          ariaLabel="Inline code"
        />
        <ToolbarBtn
          icon={FileCode}
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
          ariaLabel="Code block"
        />
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Link */}
      <div className="toolbar-group toolbar-dropdown-wrap">
        <ToolbarBtn
          icon={LinkIcon}
          active={editor.isActive('link')}
          onClick={openLinkPopup}
          title="Insert link"
          ariaLabel="Insert link"
        />
        {linkOpen && (
          <>
            <div className="toolbar-dropdown-backdrop" onClick={() => { setLinkOpen(false); setLinkUrl(''); }} aria-hidden="true" />
            <div className="toolbar-dropdown toolbar-dropdown-link">
              <input
                type="url"
                className="toolbar-input"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setLink()}
                aria-label="Link URL"
              />
              <button type="button" className="toolbar-dropdown-item" onClick={setLink}>
                Apply
              </button>
              {linkUrl.trim() && (
                <button
                  type="button"
                  className="toolbar-dropdown-item"
                  onClick={() => { window.open(linkUrl.trim(), '_blank', 'noopener,noreferrer'); }}
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                  Open in new tab
                </button>
              )}
              <button type="button" className="toolbar-dropdown-item" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); setLinkUrl(''); }}>
                Remove link
              </button>
            </div>
          </>
        )}
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Subscript / Superscript */}
      <div className="toolbar-group">
        <ToolbarBtn
          icon={SubscriptIcon}
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          title="Subscript"
          ariaLabel="Subscript"
        />
        <ToolbarBtn
          icon={SuperscriptIcon}
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          title="Superscript"
          ariaLabel="Superscript"
        />
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Alignment */}
      <div className="toolbar-group">
        <ToolbarBtn
          icon={AlignLeft}
          active={currentAlign === 'left'}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align left"
          ariaLabel="Align left"
        />
        <ToolbarBtn
          icon={AlignCenter}
          active={currentAlign === 'center'}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align center"
          ariaLabel="Align center"
        />
        <ToolbarBtn
          icon={AlignRight}
          active={currentAlign === 'right'}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align right"
          ariaLabel="Align right"
        />
        <ToolbarBtn
          icon={AlignJustify}
          active={currentAlign === 'justify'}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justify"
          ariaLabel="Justify"
        />
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Lists */}
      <div className="toolbar-group">
        <ToolbarBtn
          icon={List}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
          ariaLabel="Bullet list"
        />
        <ToolbarBtn
          icon={ListOrdered}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
          ariaLabel="Numbered list"
        />
        <ToolbarBtn
          icon={ListTodo}
          active={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task list"
          ariaLabel="Task list"
        />
      </div>
      <span className="toolbar-sep" aria-hidden="true" />

      {/* Image */}
      <div className="toolbar-group toolbar-dropdown-wrap">
        <ToolbarBtn
          icon={ImagePlus}
          active={false}
          onClick={() => setImageOpen((o) => !o)}
          title="Insert image"
          ariaLabel="Insert image"
        />
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          className="toolbar-file-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleImageFile}
        />
        {imageOpen && (
          <>
            <div className="toolbar-dropdown-backdrop" onClick={() => { setImageOpen(false); setImageUrl(''); }} aria-hidden="true" />
            <div className="toolbar-dropdown toolbar-dropdown-link">
              <button
                type="button"
                className="toolbar-dropdown-item"
                onClick={() => imageFileInputRef.current?.click()}
              >
                <Upload size={14} />
                Choose from computer
              </button>
              <input
                type="url"
                className="toolbar-input"
                placeholder="Or paste image URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && insertImageFromUrl()}
                aria-label="Image URL"
              />
              <button type="button" className="toolbar-dropdown-item" onClick={insertImageFromUrl} disabled={!imageUrl.trim()}>
                Insert from URL
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
