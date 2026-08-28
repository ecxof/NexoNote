/**
 * Reusable modal components: Confirm, Prompt, Alert.
 * Themed to match app; supports validation and accessibility.
 */
import { useState, useEffect } from 'react';

const SIDEBAR_ACTIVE_BG = '#1A2942';

function ModalOverlay({ children, onClose }) {
  useEffect(() => {
    const handleEscape = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  return (
    <ModalOverlay onClose={onCancel}>
      <div className="modal-header">
        <h2 className="modal-title">{title}</h2>
      </div>
      {message && <p className="modal-message">{message}</p>}
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={() => { onConfirm?.(); onCancel?.(); }}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalOverlay>
  );
}

export function PromptModal({
  title,
  message,
  initialValue = '',
  placeholder = '',
  submitLabel = 'OK',
  cancelLabel = 'Cancel',
  validate = (v) => (v?.trim() ? null : 'Required'),
  onSubmit,
  onCancel,
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(null);

  const handleSubmit = () => {
    const err = validate(value);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit?.(value?.trim());
    onCancel?.();
  };

  return (
    <ModalOverlay onClose={onCancel}>
      <div className="modal-header">
        <h2 className="modal-title">{title}</h2>
      </div>
      {message && <p className="modal-message">{message}</p>}
      <input
        type="text"
        className="modal-input"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder={placeholder}
        autoFocus
        aria-invalid={!!error}
        aria-describedby={error ? 'modal-error' : undefined}
      />
      {error && <p id="modal-error" className="modal-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="btn-primary" onClick={handleSubmit}>
          {submitLabel}
        </button>
      </div>
    </ModalOverlay>
  );
}

export function AlertModal({ title, message, onClose }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal-header">
        <h2 className="modal-title">{title}</h2>
      </div>
      {message && <p className="modal-message">{message}</p>}
      <div className="modal-actions">
        <button type="button" className="btn-primary" onClick={onClose}>
          OK
        </button>
      </div>
    </ModalOverlay>
  );
}
