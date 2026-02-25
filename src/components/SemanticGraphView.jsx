/**
 * SemanticGraphView – full-screen force-directed graph of note connections.
 *
 * Layout:
 *   ┌────────────── Top Nav Bar ──────────────────────┐
 *   │ Semantic Graph   Visualizing: [Note Title]  [X] │
 *   ├──────────────────────────┬──────────────────────┤
 *   │                          │  Details Panel       │
 *   │   ForceGraph2D Canvas    │  (slides in on click)│
 *   │                          │                      │
 *   └──────────────────────────┴──────────────────────┘
 *
 * Central node = current note (pinned, blue border).
 * Surrounding nodes = semantically related notes (fetched via findSemanticLinks).
 * Edges = dashed lines, opacity proportional to similarity score.
 * Click any node → right panel shows metadata, keywords, Open Note / Flashcards.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { X, ExternalLink, CreditCard, Clock, Network } from "lucide-react";
import { findSemanticLinks } from "../services/semanticLinkingService";

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Node dimensions in graph-space pixels (divided by globalScale when drawing).
const NODE_W = 140;
const NODE_H = 38;
const NODE_R = 7;
const FONT_SIZE = 11;

// Palette for tags and connection dots.
const PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];
const paletteColor = (i) => PALETTE[i % PALETTE.length];

// ─── Main component ────────────────────────────────────────────────────────────

export default function SemanticGraphView({
  note,
  notes = [],
  onClose,
  onOpenInTab,
}) {
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 900, height: 600 });

  const [relatedData, setRelatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const PANEL_W = 340;

  // ── Fetch semantic links ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!note?.id) {
      setLoading(false);
      return;
    }
    // Compare against every note regardless of folder.
    const others = (notes || []).filter((n) => n.id !== note.id);
    if (others.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    findSemanticLinks(
      note.content ?? "",
      others.map((n) => ({ id: n.id, content: n.content ?? "" })),
      { threshold: 0.3, maxResults: 40, topKeywords: 6 },
    ).then(({ links, error }) => {
      setLoading(false);
      if (error) setFetchError(error);
      else setRelatedData(links || []);
    });
  }, [note?.id, note?.content, notes]);

  // ── Build graph data ─────────────────────────────────────────────────────────

  const graphData = useMemo(() => {
    const noteById = new Map((notes || []).map((n) => [n.id, n]));

    const centerNode = {
      id: note?.id ?? "__center__",
      title: note?.title || "Current Note",
      tags: note?.tags ?? [],
      updatedAt: note?.updatedAt,
      isCenter: true,
      fx: 0,
      fy: 0,
      val: 2.5,
      keywords: [],
      score: 1,
    };

    const relatedNodes = relatedData.map((link) => {
      const nid = link.linked_note_id ?? link.note_id;
      const other = noteById.get(nid);
      return {
        id: nid,
        title: other?.title || "Untitled",
        tags: other?.tags ?? [],
        updatedAt: other?.updatedAt,
        isCenter: false,
        val: 1,
        score: link.similarity_score ?? 0,
        keywords: link.matched_keywords ?? [],
      };
    });

    const links = relatedData.map((link) => ({
      source: note?.id ?? "__center__",
      target: link.linked_note_id ?? link.note_id,
      score: link.similarity_score ?? 0,
      keywords: link.matched_keywords ?? [],
    }));

    return { nodes: [centerNode, ...relatedNodes], links };
  }, [note, relatedData, notes]);

  // ── Measure container (ResizeObserver) ───────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setDims({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    const { width, height } = el.getBoundingClientRect();
    setDims({ width: Math.floor(width), height: Math.floor(height) });
    return () => ro.disconnect();
  }, []);

  // ── Zoom to fit when graph settles ──────────────────────────────────────────

  const handleEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(300, 60);
  }, []);

  // ── Canvas – node drawing ────────────────────────────────────────────────────

  const selectedNodeRef = useRef(selectedNode);
  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  const drawNode = useCallback((node, ctx, globalScale) => {
    const isSelected = selectedNodeRef.current?.id === node.id;
    const w = NODE_W / globalScale;
    const h = NODE_H / globalScale;
    const r = NODE_R / globalScale;
    const nx = node.x - w / 2;
    const ny = node.y - h / 2;

    // Glow for center / selected.
    if (node.isCenter || isSelected) {
      ctx.save();
      ctx.shadowColor = node.isCenter
        ? "rgba(59,130,246,0.55)"
        : "rgba(139,92,246,0.55)";
      ctx.shadowBlur = 14 / globalScale;
    }

    // Background fill.
    ctx.fillStyle = node.isCenter
      ? "#1e3a5f"
      : isSelected
        ? "#2d1b4e"
        : "#1e293b";
    roundRect(ctx, nx, ny, w, h, r);
    ctx.fill();

    if (node.isCenter || isSelected) ctx.restore();

    // Border.
    ctx.strokeStyle = node.isCenter
      ? "#3b82f6"
      : isSelected
        ? "#8b5cf6"
        : "#334155";
    ctx.lineWidth = (node.isCenter ? 2.5 : 1) / globalScale;
    roundRect(ctx, nx, ny, w, h, r);
    ctx.stroke();

    // Title text.
    const fs = FONT_SIZE / globalScale;
    ctx.font = `${node.isCenter ? "600 " : ""}${fs}px Inter,system-ui,sans-serif`;
    ctx.fillStyle = node.isCenter ? "#93c5fd" : "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxW = (NODE_W - 20) / globalScale;
    let label = node.title;
    // Ellipsize if needed.
    while (ctx.measureText(label).width > maxW && label.length > 4) {
      label = label.slice(0, -2) + "…";
    }
    ctx.fillText(label, node.x, node.y);

    // Badge – number of shared keywords (connection strength proxy).
    if (!node.isCenter && node.keywords?.length > 0) {
      const badge = String(node.keywords.length);
      const bR = 7.5 / globalScale;
      const bx = node.x + w / 2 - bR;
      const by = node.y - h / 2 + bR;
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(bx, by, bR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${8 / globalScale}px Inter,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge, bx, by);
    }
  }, []);

  // Pointer hit area = same rounded rect.
  const pointerArea = useCallback((node, color, ctx, globalScale) => {
    ctx.fillStyle = color;
    roundRect(
      ctx,
      node.x - NODE_W / globalScale / 2,
      node.y - NODE_H / globalScale / 2,
      NODE_W / globalScale,
      NODE_H / globalScale,
      NODE_R / globalScale,
    );
    ctx.fill();
  }, []);

  // ── Canvas – link drawing ────────────────────────────────────────────────────

  const drawLink = useCallback((link, ctx, globalScale) => {
    const s = link.source;
    const t = link.target;
    if (!s?.x || !t?.x) return;
    const opacity = Math.min(0.8, 0.2 + (link.score ?? 0) * 0.7);
    ctx.save();
    ctx.setLineDash([5 / globalScale, 4 / globalScale]);
    ctx.strokeStyle = `rgba(99,179,237,${opacity})`;
    ctx.lineWidth = (0.8 + (link.score ?? 0)) / globalScale;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  // ── Node click ───────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedNode(null), 280);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const formatDate = (d) => {
    if (!d) return "Unknown";
    try {
      return new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" });
    } catch {
      return "Unknown";
    }
  };

  const connectedLink = relatedData.find(
    (l) => (l.linked_note_id ?? l.note_id) === selectedNode?.id,
  );

  const canvasW = Math.max(200, dims.width - (panelOpen ? PANEL_W : 0));
  const canvasH = dims.height;
  const isLightTheme =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "light";
  const canvasBackgroundColor = isLightTheme ? "#f1f5f9" : "#0f172a";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="sgv-root">
      {/* ── Top nav ───────────────────────────────────────────────────────── */}
      <header className="sgv-topbar">
        <div className="sgv-topbar-left">
          <Network size={18} className="sgv-topbar-icon" aria-hidden />
          <span className="sgv-topbar-title">Semantic Graph</span>
          {note?.title && (
            <span className="sgv-topbar-subtitle">
              Visualizing connections in <strong>{note.title}</strong>
            </span>
          )}
        </div>
        <button
          type="button"
          className="sgv-close-btn"
          onClick={onClose}
          aria-label="Close graph view"
        >
          <X size={16} />
          Close View
        </button>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="sgv-body">
        {/* Canvas area */}
        <div ref={containerRef} className="sgv-canvas-wrap">
          {loading ? (
            <div className="sgv-state-msg">
              <span className="sgv-spinner" aria-hidden />
              Finding connections…
            </div>
          ) : fetchError ? (
            <div className="sgv-state-msg sgv-state-error">{fetchError}</div>
          ) : graphData.nodes.length <= 1 ? (
            <div className="sgv-state-msg">
              No related notes found yet. Add more notes with shared domain
              concepts (e.g. "backpropagation", "deadlock") and reopen this
              view.
            </div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              width={canvasW}
              height={canvasH}
              graphData={graphData}
              backgroundColor={canvasBackgroundColor}
              nodeCanvasObject={drawNode}
              nodePointerAreaPaint={pointerArea}
              linkCanvasObject={drawLink}
              linkDirectionalParticles={0}
              nodeLabel=""
              onNodeClick={handleNodeClick}
              onEngineStop={handleEngineStop}
              cooldownTicks={150}
              d3AlphaDecay={0.018}
              d3VelocityDecay={0.28}
              enableZoomInteraction
              enablePanInteraction
            />
          )}
        </div>

        {/* ── Details panel ─────────────────────────────────────────────── */}
        <aside
          className={`sgv-panel${panelOpen ? " sgv-panel-open" : ""}`}
          aria-label="Note details"
        >
          {selectedNode && (
            <>
              {/* Header */}
              <div className="sgv-panel-header">
                <h2 className="sgv-panel-title" title={selectedNode.title}>
                  {selectedNode.title}
                </h2>
                <button
                  type="button"
                  className="sgv-panel-close"
                  onClick={closePanel}
                  aria-label="Close panel"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="sgv-panel-body">
                {/* Tags */}
                {selectedNode.tags?.length > 0 && (
                  <div className="sgv-panel-tags">
                    {selectedNode.tags.map((tag, i) => (
                      <span
                        key={tag}
                        className="sgv-panel-tag"
                        style={{
                          backgroundColor: paletteColor(i) + "22",
                          color: paletteColor(i),
                          borderColor: paletteColor(i) + "55",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Last modified */}
                <p className="sgv-panel-meta">
                  <Clock size={13} aria-hidden />
                  Last modified: {formatDate(selectedNode.updatedAt)}
                </p>

                {/* Actions */}
                {!selectedNode.isCenter && (
                  <div className="sgv-panel-actions">
                    <button
                      type="button"
                      className="sgv-btn-primary"
                      onClick={() => {
                        onOpenInTab?.({ type: "note", id: selectedNode.id });
                        onClose?.();
                      }}
                    >
                      Open Note
                      <ExternalLink size={14} aria-hidden />
                    </button>

                    <button
                      type="button"
                      className="sgv-btn-secondary"
                      disabled
                      title="Flashcards coming soon"
                    >
                      <CreditCard size={14} aria-hidden />
                      Review Flashcards
                      <span className="sgv-btn-badge">0</span>
                    </button>
                  </div>
                )}

                {/* Similarity score bar */}
                {!selectedNode.isCenter && selectedNode.score > 0 && (
                  <div className="sgv-panel-score-wrap">
                    <span className="sgv-panel-score-label">Similarity</span>
                    <div className="sgv-panel-score-bar-track">
                      <div
                        className="sgv-panel-score-bar-fill"
                        style={{
                          width: `${Math.round(selectedNode.score * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="sgv-panel-score-value">
                      {Math.round(selectedNode.score * 100)}%
                    </span>
                  </div>
                )}

                {/* Connected concepts */}
                {connectedLink?.matched_keywords?.length > 0 && (
                  <section className="sgv-panel-concepts">
                    <h3 className="sgv-panel-concepts-title">
                      Connected Concepts
                    </h3>
                    <ul className="sgv-panel-concepts-list">
                      {connectedLink.matched_keywords.map((kw, i) => (
                        <li key={kw} className="sgv-panel-concept-item">
                          <span
                            className="sgv-panel-concept-dot"
                            style={{ backgroundColor: paletteColor(i) }}
                            aria-hidden
                          />
                          <div className="sgv-panel-concept-text">
                            <span className="sgv-panel-concept-kw">{kw}</span>
                            <span className="sgv-panel-concept-sub">
                              shared term
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </>
          )}

          {/* Empty state when panel open but no node selected (shouldn't happen) */}
          {!selectedNode && panelOpen && (
            <div className="sgv-panel-empty">Click a node to see details.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
