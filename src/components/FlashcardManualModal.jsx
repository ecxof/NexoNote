import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { createFlashcard, updateFlashcard } from '../services/flashcardService';

const TYPES = [
  { key: 'flip', label: 'Flip Card' },
  { key: 'mcq', label: 'Multiple Choice' },
  { key: 'true_false', label: 'True / False' },
];

export default function FlashcardManualModal({
  note,
  editingCard = null,
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(editingCard?.id);
  const [type, setType] = useState(editingCard?.type || 'flip');
  const [prompt, setPrompt] = useState(editingCard?.prompt || '');
  const [back, setBack] = useState(editingCard?.back || '');
  const [correctAnswer, setCorrectAnswer] = useState(
    editingCard?.correctAnswer === true ? true : editingCard?.correctAnswer === false ? false : true
  );
  const [explanation, setExplanation] = useState(editingCard?.explanation || '');
  const [options, setOptions] = useState(
    editingCard?.type === 'mcq' && Array.isArray(editingCard.options) && editingCard.options.length
      ? editingCard.options.map((opt) => ({ id: opt.id || nanoid(), text: opt.text || '' }))
      : [
          { id: nanoid(), text: '' },
          { id: nanoid(), text: '' },
        ]
  );
  const [correctOptionIndex, setCorrectOptionIndex] = useState(
    Number.isFinite(Number(editingCard?.correctOptionIndex)) ? Number(editingCard.correctOptionIndex) : 0
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (type !== 'mcq') return;
    if (correctOptionIndex < options.length) return;
    setCorrectOptionIndex(0);
  }, [type, options.length, correctOptionIndex]);

  const normalizedOptions = useMemo(
    () => options
      .map((opt, index) => ({ id: opt.id, text: opt.text.trim(), order: index }))
      .filter((opt) => opt.text.length > 0),
    [options]
  );

  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, { id: nanoid(), text: '' }]);
  }

  function removeOption(id) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  function resetForNextCard() {
    setPrompt('');
    setBack('');
    setCorrectAnswer(true);
    setExplanation('');
    setOptions([
      { id: nanoid(), text: '' },
      { id: nanoid(), text: '' },
    ]);
    setCorrectOptionIndex(0);
    setError('');
  }

  async function handleSave(closeAfterSave = true) {
    if (!isEditing && !note?.id) {
      setError('A source note is required.');
      return;
    }
    if (!prompt.trim()) {
      setError('Prompt is required.');
      return;
    }
    if (type === 'flip' && !back.trim()) {
      setError('Back content is required for flip cards.');
      return;
    }
    if (type === 'mcq') {
      if (normalizedOptions.length < 2) {
        setError('MCQ requires 2-6 options.');
        return;
      }
      if (correctOptionIndex < 0 || correctOptionIndex >= normalizedOptions.length) {
        setError('Select a correct option.');
        return;
      }
    }

    setError('');
    setSaving(true);
    const payload = {
      noteId: note?.id || editingCard?.sourceNoteId,
      sourceNoteId: note?.id || editingCard?.sourceNoteId,
      topicId: note?.folderId || editingCard?.topicId || null,
      type,
      prompt: prompt.trim(),
      back: type === 'mcq'
        ? (normalizedOptions[correctOptionIndex]?.text || '')
        : type === 'true_false'
          ? (correctAnswer ? 'True' : 'False')
          : back.trim(),
      correctAnswer: type === 'true_false' ? correctAnswer : null,
      correctOptionIndex: type === 'mcq' ? correctOptionIndex : null,
      options: type === 'mcq' ? normalizedOptions : [],
      explanation: explanation.trim(),
      status: 'SAVED',
    };

    try {
      if (isEditing) {
        await updateFlashcard(editingCard.id, payload);
      } else {
        await createFlashcard(payload);
      }
      onSaved?.();
      if (closeAfterSave || isEditing) onClose?.();
      else resetForNextCard();
    } catch (e) {
      setError(e?.message || 'Failed to save flashcard.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-content flashcard-modal flashcard-modal-large flashcard-modal-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="flashcard-modal-header">
          <div>
            <h2 className="modal-title">{isEditing ? 'Edit Flashcard' : 'Create Flashcards'}</h2>
            <p className="modal-message">
              {isEditing
                ? 'Update this flashcard.'
                : 'Create one or more flashcards without reopening this modal.'}
            </p>
          </div>
          <button type="button" className="flashcard-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flashcard-modal-body">
          <div className="flashcard-create-types">
            {TYPES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`flashcard-type-pill ${type === entry.key ? 'active' : ''}`}
                onClick={() => setType(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <label className="flashcard-form-label">
            {type === 'flip' ? 'Front (question)' : type === 'mcq' ? 'Question' : 'Statement'}
            <textarea
              className="flashcard-draft-input"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={type === 'true_false' ? 'Enter a true/false statement...' : 'Enter prompt...'}
            />
          </label>

          {type === 'flip' && (
            <label className="flashcard-form-label">
              Back (answer)
              <textarea
                className="flashcard-draft-input"
                rows={3}
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="Enter answer..."
              />
            </label>
          )}

          {type === 'true_false' && (
            <div className="flashcard-options-editor">
              <p className="flashcard-generate-label">Correct Answer</p>
              <div className="flashcard-scope-toggle">
                <button
                  type="button"
                  className={`flashcard-type-pill ${correctAnswer === true ? 'active' : ''}`}
                  onClick={() => setCorrectAnswer(true)}
                >
                  True
                </button>
                <button
                  type="button"
                  className={`flashcard-type-pill ${correctAnswer === false ? 'active' : ''}`}
                  onClick={() => setCorrectAnswer(false)}
                >
                  False
                </button>
              </div>
            </div>
          )}

          {type === 'mcq' && (
            <div className="flashcard-options-editor">
              <div className="flashcard-options-header">
                <span>Options (2-6)</span>
                <button type="button" className="btn-secondary flashcard-option-add" onClick={addOption}>
                  <Plus size={14} />
                  Add option
                </button>
              </div>
              {options.map((opt, idx) => (
                <div key={opt.id} className="flashcard-option-row">
                  <input
                    type="radio"
                    name="manual-mcq-correct"
                    checked={correctOptionIndex === idx}
                    onChange={() => setCorrectOptionIndex(idx)}
                  />
                  <input
                    type="text"
                    className="modal-input"
                    value={opt.text}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOptions((prev) => prev.map((x) => (x.id === opt.id ? { ...x, text: value } : x)));
                    }}
                    placeholder={`Option ${idx + 1}`}
                  />
                  <button type="button" className="flashcard-option-delete" onClick={() => removeOption(opt.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flashcard-form-label">
            Explanation (optional)
            <textarea
              className="flashcard-draft-input"
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="modal-error">{error}</p>}
        <div className="flashcard-modal-footer flashcard-modal-footer-sticky">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          {!isEditing && (
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => handleSave(false)}>
              Save & Add Another
            </button>
          )}
          <button type="button" className="btn-primary" disabled={saving} onClick={() => handleSave(true)}>
            {isEditing ? 'Save Changes' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
