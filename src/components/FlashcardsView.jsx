import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Search, Trash2 } from 'lucide-react';
import { deleteFlashcard, getFlashcardLibrary, getFlashcards } from '../services/flashcardService';
import FlashcardManualModal from './FlashcardManualModal';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'mcq', label: 'MCQ' },
  { key: 'flip', label: 'Flip Cards' },
  { key: 'true_false', label: 'True / False' },
];

function formatDate(value) {
  if (!value) return 'Not reviewed yet';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not reviewed yet';
  return d.toLocaleDateString();
}

function typeLabel(type) {
  return FILTERS.find((f) => f.key === type)?.label || type;
}

export default function FlashcardsView({ notes = [], refreshKey = 0, onStartReviewSession, onLibraryChanged }) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [cards, setCards] = useState([]);
  const [library, setLibrary] = useState([]);
  const [editingCard, setEditingCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [libraryList, cardList] = await Promise.all([
        getFlashcardLibrary(),
        getFlashcards({ status: 'SAVED' }),
      ]);
      if (!mounted) return;
      setLibrary(libraryList);
      setCards(cardList);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [refreshKey]);

  const grouped = useMemo(() => {
    const byNote = new Map();
    for (const item of library) {
      byNote.set(item.noteId, {
        id: item.noteId,
        noteId: item.noteId,
        title: item.title || 'Untitled',
        tags: Array.isArray(item.tags) ? item.tags : [],
        totalCards: Number(item.totalCards) || 0,
        dueToday: Number(item.dueToday) || 0,
        cards: [],
      });
    }
    for (const card of cards) {
      const noteId = card.noteId || card.sourceNoteId;
      if (!noteId) continue;
      if (!byNote.has(noteId)) {
        byNote.set(noteId, {
          id: noteId,
          noteId,
          title: card.noteTitle || 'Untitled',
          tags: [],
          totalCards: 0,
          dueToday: 0,
          cards: [],
        });
      }
      const bucket = byNote.get(noteId);
      bucket.cards.push(card);
    }
    const q = search.trim().toLowerCase();
    const list = Array.from(byNote.values())
      .filter((noteSet) => noteSet.cards.length > 0)
      .map((noteSet) => {
        const typeSet = new Set(noteSet.cards.map((c) => c.type));
        const lastReviewDate = noteSet.cards
          .map((c) => c.lastReviewDate)
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0] || null;
        return {
          ...noteSet,
          totalCards: noteSet.cards.length,
          types: Array.from(typeSet),
          lastReviewDate,
        };
      });
    return list.filter((noteSet) => {
      const matchesFilter = activeFilter === 'all' || noteSet.types.includes(activeFilter);
      const matchesSearch = !q
        || noteSet.title.toLowerCase().includes(q)
        || noteSet.tags.some((tag) => String(tag).toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [cards, library, search, activeFilter]);

  async function handleDeleteCard(cardId) {
    await deleteFlashcard(cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    onLibraryChanged?.();
  }

  return (
    <section className="flashcards-view">
      <header className="flashcards-view-header">
        <h1 className="flashcards-view-title">Flashcards</h1>
        <p className="flashcards-view-subtitle">Flashcards are grouped by note.</p>
      </header>

      <div className="flashcards-toolbar">
        <div className="flashcards-search-wrap">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search notes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flashcards-search"
          />
        </div>
        <div className="flashcards-filters">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`flashcards-filter ${activeFilter === filter.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flashcards-list">
        {loading ? (
          <div className="flashcard-empty-state"><p>Loading flashcards...</p></div>
        ) : grouped.length === 0 ? (
          <div className="flashcard-empty-state">
            <p>No flashcards yet. Create cards from note view.</p>
          </div>
        ) : (
          grouped.map((noteSet) => {
            const isExpanded = expandedId === noteSet.id;
            return (
              <article className={`flashcard-set ${isExpanded ? 'expanded' : ''}`} key={noteSet.id}>
                <button
                  type="button"
                  className="flashcard-set-header"
                  onClick={() => setExpandedId((prev) => (prev === noteSet.id ? null : noteSet.id))}
                >
                  <span className="flashcard-set-main">
                    <span className="flashcard-set-icon" aria-hidden />
                    <span>
                      <span className="flashcard-set-title">{noteSet.title}</span>
                      <span className="flashcard-set-meta">
                        {noteSet.totalCards} cards
                      </span>
                      {noteSet.tags.length > 0 && (
                        <span className="flashcard-set-meta">
                          {noteSet.tags.map((tag) => (
                            <span key={`${noteSet.noteId}-${tag}`} className="flashcard-type-pill">
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isExpanded && (
                  <div className="flashcard-set-body">
                    <p className="flashcard-last-reviewed">Last reviewed: {formatDate(noteSet.lastReviewDate)}</p>
                    <div className="flashcard-cards-list">
                      {noteSet.cards.map((card) => (
                        <div className="flashcard-library-item" key={card.id}>
                          <div className="flashcard-library-main">
                            <strong>{typeLabel(card.type)}</strong>
                            <p>{card.prompt}</p>
                          </div>
                          <div className="flashcard-library-actions">
                            <button type="button" className="flashcard-link-btn" onClick={() => setEditingCard(card)}>
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button type="button" className="flashcard-link-btn" onClick={() => handleDeleteCard(card.id)}>
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <footer className="flashcard-set-footer">
                  <button
                    type="button"
                    className="flashcard-review-btn"
                    onClick={() => onStartReviewSession?.({
                      noteId: noteSet.noteId,
                      type: activeFilter === 'all' ? null : activeFilter,
                      dueOnly: false,
                    })}
                  >
                    Review
                  </button>
                </footer>
              </article>
            );
          })
        )}
      </div>
      {editingCard && (
        <FlashcardManualModal
          note={notes.find((n) => n.id === editingCard.sourceNoteId) || null}
          editingCard={editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={async () => {
            setEditingCard(null);
            onLibraryChanged?.();
            const [libraryList, list] = await Promise.all([
              getFlashcardLibrary(),
              getFlashcards({ status: 'SAVED' }),
            ]);
            setLibrary(libraryList);
            setCards(list);
          }}
        />
      )}
    </section>
  );
}
