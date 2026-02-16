/**
 * PDF viewer: renders PDF using an <embed> tag with data URLs.
 * Blob URLs are converted to data URLs on the fly to avoid browser security
 * restrictions. Highlights are stored in-memory per PDF view (not persisted).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import PDFFloatingToolbar from './PDFFloatingToolbar';

const HIGHLIGHT_COLOR = '#FFEB3B';

/**
 * Convert a blob URL to a base64 data URL.
 * Blob URLs are session-specific and get blocked by <object>/<embed>/<iframe>
 * in many browsers. Data URLs don't have this restriction.
 */
async function blobUrlToDataUrl(blobUrl) {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function PDFViewer({ pdf, onExport }) {
  const containerRef = useRef(null);
  const embedRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cache resolved data URLs so tab-switching doesn't re-convert
  const urlCacheRef = useRef(new Map());

  function hasElectron() {
    return typeof window !== 'undefined' && window.electronAPI;
  }

  useEffect(() => {
    if (!pdf?.filePath || !pdf?.id) {
      setPdfUrl(null);
      return;
    }

    // Serve from cache if available
    if (urlCacheRef.current.has(pdf.id)) {
      setPdfUrl(urlCacheRef.current.get(pdf.id));
      return;
    }

    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setError(null);

      try {
        let url = pdf.filePath;

        if (hasElectron()) {
          // Electron: filePath is a real filesystem path — use as-is
        } else if (url.startsWith('data:')) {
          // Already a data URL — ready to use
        } else if (url.startsWith('blob:')) {
          // Convert blob URL → data URL to avoid security errors
          url = await blobUrlToDataUrl(url);
        } else {
          throw new Error('Unsupported PDF file path format');
        }

        if (!cancelled) {
          urlCacheRef.current.set(pdf.id, url);
          setPdfUrl(url);
        }
      } catch (e) {
        console.error('Failed to resolve PDF URL:', e);
        if (!cancelled) {
          setError('This PDF can no longer be loaded. Please re-import it.');
          setPdfUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [pdf?.id, pdf?.filePath]);

  const handleHighlight = useCallback((highlight) => {
    setHighlights((prev) => [...prev, highlight]);
  }, []);

  const handleRemoveHighlight = useCallback((targetSelection) => {
    setHighlights((prev) =>
      prev.filter((h) => {
        if (h.pageIndex !== targetSelection.pageIndex) return true;
        return !h.rects.some((r) =>
          targetSelection.rects.some((tr) =>
            Math.abs(r.left - tr.left) < 5 && Math.abs(r.top - tr.top) < 5
          )
        );
      })
    );
  }, []);

  const handleCopy = useCallback(() => {
    // Copy is handled in PDFFloatingToolbar via navigator.clipboard
  }, []);

  const handleExplain = useCallback(() => {
    // Placeholder for AI feature
  }, []);

  const handleExport = useCallback(() => {
    if (onExport) {
      onExport(pdf, highlights);
    } else if (pdfUrl) {
      // Fallback: open in new window for printing
      window.open(pdfUrl, '_blank');
    }
  }, [pdf, highlights, onExport, pdfUrl]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="pdf-viewer pdf-viewer-empty">
        <p>Loading PDF…</p>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="pdf-viewer pdf-viewer-empty">
        <p>{error}</p>
      </div>
    );
  }

  // --- No PDF ---
  if (!pdf || !pdfUrl) {
    return (
      <div className="pdf-viewer pdf-viewer-empty">
        <p>No PDF loaded</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer" ref={containerRef}>
      <div className="pdf-viewer-header">
        <h2 className="pdf-viewer-title">{pdf.title}</h2>
      </div>
      <div className="pdf-viewer-content">
        <embed
          ref={embedRef}
          src={pdfUrl}
          type="application/pdf"
          className="pdf-viewer-iframe"
        />
        {selection && (
          <PDFFloatingToolbar
            selection={selection}
            highlights={highlights}
            onHighlight={handleHighlight}
            onRemoveHighlight={handleRemoveHighlight}
            onCopy={handleCopy}
            onExplain={handleExplain}
          />
        )}
      </div>
    </div>
  );
}
