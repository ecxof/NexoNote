import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { getDueFlashcards, getFlashcards, reviewFlashcard } from '../services/flashcardService';

const DIFFICULTIES = [
  { label: 'Again', sub: '< 1 m', rating: 0, difficulty: 'again', tone: 'again' },
  { label: 'Hard', sub: '3 hours', rating: 3, difficulty: 'hard', tone: 'hard' },
  { label: 'Good', sub: '1 day', rating: 4, difficulty: 'good', tone: 'good' },
  { label: 'Easy', sub: '2 days', rating: 5, difficulty: 'easy', tone: 'easy' },
];

function typeLabel(type) {
  if (type === 'mcq') return 'Multiple Choice';
  if (type === 'true_false') return 'True / False';
  return 'Flip Card';
}

export default function FlashcardReviewSession({ noteId = null, topicId = null, type = null, dueOnly = true, onClose }) {
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedTf, setSelectedTf] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const due = dueOnly
        ? await getDueFlashcards({ noteId, topicId, type })
        : await getFlashcards({ status: 'SAVED', noteId, topicId, type });
      if (!mounted) return;
      setCards(due);
      setIndex(0);
      setFlipped(false);
      setSelectedOption(null);
      setSelectedTf(null);
      setRevealed(false);
      setResult(null);
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [noteId, topicId, type, dueOnly]);

  const card = cards[index] || null;
  const progress = cards.length ? `${index + 1}/${cards.length}` : '0/0';

  const mcqIsCorrect = useMemo(() => {
    if (!card || card.type !== 'mcq' || selectedOption == null) return null;
    return Number(selectedOption) === Number(card.correctOptionIndex);
  }, [card, selectedOption]);

  const tfIsCorrect = useMemo(() => {
    if (!card || card.type !== 'true_false' || selectedTf == null) return null;
    return !!selectedTf === !!card.correctAnswer;
  }, [card, selectedTf]);

  useEffect(() => {
    const onKey = (e) => {
      if (!card || card.type !== 'flip') return;
      if (e.code !== 'Space') return;
      e.preventDefault();
      setFlipped((prev) => !prev);
      setRevealed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card]);

  function revealCurrent() {
    if (!card) return;
    if (card.type === 'mcq') {
      if (selectedOption == null) return;
      setResult(mcqIsCorrect ? 'correct' : 'incorrect');
      setRevealed(true);
      return;
    }
    if (card.type === 'true_false') {
      if (selectedTf == null) return;
      setResult(tfIsCorrect ? 'correct' : 'incorrect');
      setRevealed(true);
      return;
    }
    setFlipped(true);
    setRevealed(true);
  }

  async function submitReview(rating, difficulty) {
    if (!card || !revealed) return;
    await reviewFlashcard(card.id, rating, null, {
      result: result || null,
      difficulty,
      responseTimeMs: null,
    });
    const nextCards = cards.filter((c) => c.id !== card.id);
    setCards(nextCards);
    setIndex(0);
    setFlipped(false);
    setSelectedOption(null);
    setSelectedTf(null);
    setRevealed(false);
    setResult(null);
  }

  function onSelfAssess(isCorrect) {
    setResult(isCorrect ? 'correct' : 'incorrect');
    setRevealed(true);
  }

  return (
    <main className="main-content flashcard-review-session">
      <header className="flashcard-review-header">
        <div>
          <h2 className="flashcard-review-deck">{card?.noteTitle || 'Review Session'}</h2>
          <p className="flashcard-review-subtitle">
            {card ? `Type: ${typeLabel(card.type)}` : dueOnly ? 'No cards due' : 'No flashcards available'}
          </p>
        </div>
        <div className="flashcard-review-header-right">
          <span className="flashcard-review-progress">{progress}</span>
          <button type="button" className="flashcard-review-close" onClick={onClose} aria-label="Close review">
            <X size={18} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flashcard-review-empty">Loading due cards...</div>
      ) : !card ? (
        <div className="flashcard-review-empty">
          {dueOnly ? 'No cards are due right now.' : 'No flashcards available for this filter.'}
        </div>
      ) : (
        <>
          <section className="flashcard-review-card">
            <p className="flashcard-review-type-tag">{typeLabel(card.type)}</p>
            {card.type === 'flip' ? (
              <>
                <h3 className="flashcard-review-question">{flipped ? card.back : card.prompt}</h3>
                {!flipped && (
                  <p className="flashcard-review-shortcut">Press SPACE to flip the card.</p>
                )}
              </>
            ) : (
              <h3 className="flashcard-review-question">{card.prompt}</h3>
            )}

            {card.type === 'mcq' && (
              <div className="flashcard-review-options">
                {card.options.map((opt, idx) => (
                  <button
                    key={opt.id || idx}
                    type="button"
                    className={`flashcard-review-option ${
                      Number(selectedOption) === idx ? 'selected' : ''
                    } ${
                      revealed && Number(card.correctOptionIndex) === idx ? 'correct' : ''
                    }`}
                    onClick={() => !revealed && setSelectedOption(idx)}
                    disabled={revealed}
                  >
                    {revealed && Number(card.correctOptionIndex) === idx ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    <span>{opt.text}</span>
                  </button>
                ))}
              </div>
            )}

            {card.type === 'true_false' && (
              <div className="flashcard-review-options">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    className={`flashcard-review-option ${selectedTf === value ? 'selected' : ''}`}
                    onClick={() => !revealed && setSelectedTf(value)}
                    disabled={revealed}
                  >
                    <Circle size={16} />
                    <span>{value ? 'True' : 'False'}</span>
                  </button>
                ))}
              </div>
            )}

            {!revealed && (card.type !== 'flip' || !flipped) && (
              <button type="button" className="btn-secondary flashcard-show-answer" onClick={revealCurrent}>
                {card.type === 'flip' ? 'Flip Card' : 'Submit Answer'}
              </button>
            )}

            {card.type === 'flip' && flipped && !result && (
              <div className="flashcard-self-assess">
                <button type="button" className="btn-secondary" onClick={() => onSelfAssess(false)}>Incorrect</button>
                <button type="button" className="btn-primary" onClick={() => onSelfAssess(true)}>Correct</button>
              </div>
            )}

            {revealed && (
              <div className="flashcard-review-answer">
                {card.type !== 'flip' && (
                  <>
                    <p className="flashcard-review-answer-label">Correct Answer</p>
                    <p>{card.type === 'true_false' ? (card.correctAnswer ? 'True' : 'False') : card.back}</p>
                  </>
                )}
                {card.explanation && <p className="flashcard-review-explanation">{card.explanation}</p>}
                {result && <p className={`flashcard-review-result ${result}`}>{result === 'correct' ? 'Correct' : 'Incorrect'}</p>}
              </div>
            )}
          </section>

          <footer className="flashcard-review-ratings">
            {DIFFICULTIES.map((button) => (
              <button
                key={button.label}
                type="button"
                className={`flashcard-rating-btn ${button.tone}`}
                onClick={() => submitReview(button.rating, button.difficulty)}
                disabled={!revealed}
              >
                <span>{button.label}</span>
                <small>{button.sub}</small>
              </button>
            ))}
          </footer>
        </>
      )}
    </main>
  );
}
