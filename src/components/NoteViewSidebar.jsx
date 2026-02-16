/**
 * Note-view sidebar: back, Tags (inline pills + # input, suggestions, manage), Semantic Graph, Contents.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Tag, GitBranch, List, Plus, Map, PanelLeftClose, Pencil, Trash2 } from 'lucide-react';

/** Extract headings and their text; works even when headings contain nested tags (e.g. bold/italic). */
function extractHeadings(html) {
  if (!html || typeof html !== 'string') return [];
  const headings = [];
  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const level = parseInt(m[1], 10);
    const inner = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (inner) headings.push({ level, text: inner });
  }
  return headings;
}

const TAG_HELPER = 'This field accepts tags only. Type # to add or select a tag.';

export default function NoteViewSidebar({
  note,
  allTags = [],
  onBack,
  onCollapse,
  onTagsChange,
  onExploreSemanticMap,
  onHeadingClick,
}) {
  const headings = useMemo(() => extractHeadings(note?.content ?? ''), [note?.content]);
  const tags = note?.tags ?? [];

  const [editingValue, setEditingValue] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [editingTagIndex, setEditingTagIndex] = useState(null);
  const [editTagValue, setEditTagValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownManageMode, setDropdownManageMode] = useState(false);
  const [shake, setShake] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const [dropdownHighlight, setDropdownHighlight] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const editInputRef = useRef(null);

  const currentNoteTags = tags;
  const suggestionFilter = (query) => {
    const q = (query || '').replace(/^#+/, '').trim().toLowerCase();
    if (!q) return allTags.slice(0, 15);
    return allTags.filter((t) => t.toLowerCase().includes(q)).slice(0, 15);
  };
  const suggestions = dropdownOpen ? suggestionFilter(editingValue) : [];

  const commitTag = useCallback(
    (tagName) => {
      const t = (tagName || '').replace(/^#+/, '').trim();
      if (!t) return;
      if (currentNoteTags.includes(t)) {
        setEditingValue('');
        setIsInputVisible(false);
        setDropdownOpen(false);
        return;
      }
      onTagsChange?.(note, [...currentNoteTags, t]);
      setEditingValue('');
      setIsInputVisible(false);
      setDropdownOpen(false);
    },
    [note, currentNoteTags, onTagsChange]
  );

  const removeTag = useCallback(
    (index) => {
      const next = currentNoteTags.filter((_, i) => i !== index);
      onTagsChange?.(note, next);
      setEditingTagIndex(null);
      setCursorPosition(Math.min(index, Math.max(0, next.length)));
    },
    [note, currentNoteTags, onTagsChange]
  );

  const updateTagAt = useCallback(
    (index, newValue) => {
      const trimmed = (newValue || '').trim();
      if (trimmed === '') {
        removeTag(index);
        return;
      }
      const next = currentNoteTags.map((t, i) => (i === index ? trimmed : t));
      onTagsChange?.(note, next);
      setEditingTagIndex(null);
      setCursorPosition(index + 1);
    },
    [note, currentNoteTags, onTagsChange, removeTag]
  );

  const removeTagByName = useCallback(
    (tagName) => {
      const next = currentNoteTags.filter((t) => t !== tagName);
      onTagsChange?.(note, next);
      setDropdownOpen(false);
      setDropdownManageMode(false);
    },
    [note, currentNoteTags, onTagsChange]
  );

  useEffect(() => {
    const max = currentNoteTags.length;
    setCursorPosition((p) => (p > max ? max : p));
  }, [currentNoteTags.length]);

  useEffect(() => {
    if (!isInputVisible) return;
    containerRef.current?.blur();
    const id = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = (editingValue || '').length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [isInputVisible]);

  useEffect(() => {
    if (editingTagIndex == null) return;
    const el = editInputRef.current;
    if (!el) return;
    containerRef.current?.blur();
    const id = setTimeout(() => {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }, 0);
    return () => clearTimeout(id);
  }, [editingTagIndex]);

  useEffect(() => {
    if (!dropdownManageMode || !dropdownOpen) return;
    const close = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setDropdownManageMode(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dropdownManageMode, dropdownOpen]);

  const handlePlusClick = () => {
    setEditingValue('#');
    setIsInputVisible(true);
    setDropdownOpen(true);
    setDropdownManageMode(false);
    setShowHelper(false);
    setShake(false);
  };

  const handleContainerKeyDown = (e) => {
    if (isInputVisible || editingTagIndex !== null) return;
    if (e.key === '#') {
      e.preventDefault();
      setEditingValue('#');
      setIsInputVisible(true);
      setDropdownOpen(true);
      setDropdownManageMode(false);
      setShowHelper(false);
      setShake(false);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCursorPosition((p) => Math.max(0, p - 1));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCursorPosition((p) => Math.min(currentNoteTags.length, p + 1));
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (cursorPosition > 0) {
        const index = cursorPosition - 1;
        setEditingTagIndex(index);
        setEditTagValue(currentNoteTags[index] || '');
      }
      return;
    }
    if (e.key !== 'Tab' && e.key !== 'Shift' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (/^[a-zA-Z0-9 ]$/.test(e.key) || e.key.length > 1) {
        e.preventDefault();
        setShake(true);
        setShowHelper(true);
        setTimeout(() => setShake(false), 400);
      }
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && dropdownHighlight >= 0 && suggestions[dropdownHighlight] != null) {
        commitTag(suggestions[dropdownHighlight]);
        return;
      }
      commitTag(editingValue);
      return;
    }
    if (e.key === 'Escape') {
      setEditingValue('');
      setIsInputVisible(false);
      setDropdownOpen(false);
      setDropdownManageMode(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'Backspace' && (editingValue === '' || editingValue === '#')) {
      e.preventDefault();
      setIsInputVisible(false);
      setDropdownOpen(false);
      if (currentNoteTags.length > 0) setSelectedTagIndex(currentNoteTags.length - 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownHighlight((h) => (h < suggestions.length - 1 ? h + 1 : h));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropdownHighlight((h) => (h > 0 ? h - 1 : 0));
      return;
    }
  };

  const handleInputChange = (e) => {
    const v = e.target.value;
    if (!v.startsWith('#')) {
      setShake(true);
      setShowHelper(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setEditingValue(v);
    setDropdownOpen(true);
    setDropdownHighlight(0);
  };

  const handleInputBlur = () => {
    if (editingValue.replace(/^#+/, '').trim()) commitTag(editingValue);
    else setIsInputVisible(false);
    setDropdownOpen(false);
    setDropdownManageMode(false);
  };

  const handleEditTagKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditTagValue(currentNoteTags[editingTagIndex] ?? '');
      setEditingTagIndex(null);
      requestAnimationFrame(() => containerRef.current?.focus());
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      updateTagAt(editingTagIndex, editTagValue);
      requestAnimationFrame(() => containerRef.current?.focus());
      return;
    }
    if (e.key === 'Backspace' && editTagValue === '') {
      e.preventDefault();
      removeTag(editingTagIndex);
      requestAnimationFrame(() => containerRef.current?.focus());
    }
  };

  const handleEditTagBlur = () => {
    if (editingTagIndex == null) return;
    updateTagAt(editingTagIndex, editTagValue);
  };

  const openManageDropdown = () => {
    setEditingValue('#');
    setDropdownOpen(true);
    setDropdownManageMode(true);
    setIsInputVisible(false);
    setDropdownHighlight(0);
    if (containerRef.current) containerRef.current.focus();
  };

  return (
    <aside className="note-view-sidebar">
      <div className="note-view-sidebar-header">
        <button type="button" className="note-view-sidebar-back" onClick={onBack} aria-label="Back to home">
          <ArrowLeft size={20} />
          Back
        </button>
        {onCollapse && (
          <button
            type="button"
            className="note-view-sidebar-collapse-btn"
            onClick={onCollapse}
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>
      <div className="note-view-sidebar-body">
        <section className="note-view-sidebar-section">
          <div className="note-view-sidebar-section-row">
            <h3 className="note-view-sidebar-section-title">
              <Tag size={16} />
              Tags
            </h3>
            <div className="note-view-sidebar-tag-actions">
              <button
                type="button"
                className="note-view-sidebar-tag-action"
                onClick={openManageDropdown}
                aria-label="Manage tags"
                title="Manage tags"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="note-view-sidebar-tag-action"
                onClick={handlePlusClick}
                aria-label="Add tag"
                title="Add tag"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div
            ref={containerRef}
            className={`note-view-sidebar-tags-wrap${shake ? ' note-view-sidebar-tags-wrap-shake' : ''}`}
            tabIndex={editingTagIndex !== null || isInputVisible ? -1 : 0}
            onKeyDown={handleContainerKeyDown}
            role="group"
            aria-label="Tags"
          >
            <div className="note-view-sidebar-tag-pills">
              {currentNoteTags.map((t, i) => (
                <span key={`tag-${i}`} className="note-view-sidebar-tag-pill-wrap">
                  {cursorPosition === i && editingTagIndex === null && !isInputVisible && (
                    <span className="note-view-sidebar-tag-caret" aria-hidden />
                  )}
                  {editingTagIndex === i ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className="note-view-sidebar-tag-input note-view-sidebar-tag-input-editing"
                      value={editTagValue}
                      onChange={(e) => setEditTagValue(e.target.value)}
                      onKeyDown={handleEditTagKeyDown}
                      onBlur={handleEditTagBlur}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Edit tag"
                      autoComplete="off"
                      data-editing-tag
                    />
                  ) : (
                    <button
                      type="button"
                      className="note-view-sidebar-tag-pill"
                      onClick={() => {
                        setEditingTagIndex(i);
                        setEditTagValue(t);
                        setCursorPosition(i + 1);
                      }}
                    >
                      {t}
                    </button>
                  )}
                </span>
              ))}
              {cursorPosition === currentNoteTags.length && editingTagIndex === null && !isInputVisible && (
                <span className="note-view-sidebar-tag-caret" aria-hidden />
              )}
              {isInputVisible && (
                <input
                  ref={inputRef}
                  type="text"
                  className="note-view-sidebar-tag-input"
                  value={editingValue}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  onBlur={handleInputBlur}
                  aria-label="Tag name"
                  autoComplete="off"
                />
              )}
            </div>
            {dropdownOpen && (suggestions.length > 0 || dropdownManageMode) && (
              <div className="note-view-sidebar-tag-dropdown" role="listbox">
                {dropdownManageMode ? (
                  allTags.length === 0 ? (
                    <div className="note-view-sidebar-tag-dropdown-empty">No tags in any note yet.</div>
                  ) : (
                    allTags.map((t, i) => (
                      <div key={t} className="note-view-sidebar-tag-dropdown-item" role="option">
                        <span>{t}</span>
                        {currentNoteTags.includes(t) && (
                          <button
                            type="button"
                            className="note-view-sidebar-tag-dropdown-delete"
                            onClick={() => removeTagByName(t)}
                            aria-label={`Remove tag ${t}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))
                  )
                ) : (
                  suggestions.map((t, i) => (
                    <button
                      key={t}
                      type="button"
                      className={`note-view-sidebar-tag-dropdown-item${i === dropdownHighlight ? ' note-view-sidebar-tag-dropdown-item-highlight' : ''}`}
                      role="option"
                      onClick={() => {
                        commitTag(t);
                      }}
                    >
                      {t}
                    </button>
                  ))
                )}
              </div>
            )}
            {showHelper && (
              <p className="note-view-sidebar-tag-helper" role="status">
                {TAG_HELPER}
              </p>
            )}
          </div>
        </section>
        <section className="note-view-sidebar-section">
          <h3 className="note-view-sidebar-section-title">
            <GitBranch size={16} />
            Semantic Graph
          </h3>
          <div className="note-view-sidebar-graph">
            <p className="note-view-sidebar-placeholder">Graph view (coming later).</p>
            <button
              type="button"
              className="note-view-sidebar-explore-map"
              onClick={() => onExploreSemanticMap?.()}
            >
              <Map size={14} />
              Explore Semantic Map
            </button>
          </div>
        </section>
        <section className="note-view-sidebar-section">
          <h3 className="note-view-sidebar-section-title">
            <List size={16} />
            Contents
          </h3>
          <div className="note-view-sidebar-contents">
            {headings.length === 0 ? (
              <p className="note-view-sidebar-placeholder">No headings in this note.</p>
            ) : (
              <ul className="note-view-sidebar-outline">
                {headings.map((h, i) => (
                  <li
                    key={i}
                    className="note-view-sidebar-outline-item"
                    style={{ paddingLeft: (h.level - 1) * 12 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => onHeadingClick?.(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onHeadingClick?.(i);
                      }
                    }}
                    aria-label={`Go to: ${h.text}`}
                  >
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
