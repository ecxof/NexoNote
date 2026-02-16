/**
 * PDF floating toolbar: appears on text selection in PDF viewer.
 * Tools: Highlight, Remove highlight, Explain This (placeholder), Copy.
 */
import { Highlighter, Eraser, Sparkles, Copy } from 'lucide-react';

const HIGHLIGHT_COLOR = '#FFEB3B'; // Default yellow highlight

export default function PDFFloatingToolbar({
  selection,
  highlights,
  onHighlight,
  onRemoveHighlight,
  onCopy,
  onExplain,
}) {

  if (!selection) return null;

  const { top, left, text } = selection;
  const hasHighlight = highlights?.some((h) => 
    h.pageIndex === selection.pageIndex &&
    h.rects.some((r) => 
      Math.abs(r.left - selection.rects[0]?.left) < 5 &&
      Math.abs(r.top - selection.rects[0]?.top) < 5
    )
  );

  const handleHighlight = () => {
    if (hasHighlight) {
      onRemoveHighlight?.(selection);
    } else {
      onHighlight?.({
        pageIndex: selection.pageIndex,
        rects: selection.rects,
        color: HIGHLIGHT_COLOR,
      });
    }
  };

  const handleCopy = () => {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        onCopy?.();
      });
    }
  };

  return (
    <div
      className="pdf-floating-toolbar"
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="pdf-floating-toolbar-inner">
        <button
          type="button"
          className="pdf-floating-toolbar-btn"
          onClick={handleHighlight}
          title={hasHighlight ? 'Remove highlight' : 'Highlight'}
          aria-label={hasHighlight ? 'Remove highlight' : 'Highlight'}
        >
          <Highlighter size={17} strokeWidth={2} />
        </button>
        {hasHighlight && (
          <button
            type="button"
            className="pdf-floating-toolbar-btn"
            onClick={() => onRemoveHighlight?.(selection)}
            title="Remove highlight"
            aria-label="Remove highlight"
          >
            <Eraser size={17} strokeWidth={2} />
          </button>
        )}
        <span className="pdf-floating-toolbar-sep" aria-hidden />
        <button
          type="button"
          className="pdf-floating-toolbar-btn pdf-floating-toolbar-btn-ai"
          onClick={() => onExplain?.()}
          title="Explain This (Coming soon)"
          aria-label="Explain This"
        >
          <Sparkles size={17} strokeWidth={2} />
          <span className="pdf-floating-toolbar-btn-ai-label">Explain This</span>
        </button>
        <span className="pdf-floating-toolbar-sep" aria-hidden />
        <button
          type="button"
          className="pdf-floating-toolbar-btn"
          onClick={handleCopy}
          title="Copy"
          aria-label="Copy selected text"
        >
          <Copy size={17} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
