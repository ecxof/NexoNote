/**
 * Right contextual sidebar: AI Assistant and Flashcards for the current note.
 * Design-only for now; resizable and collapsible like the left sidebar.
 */
import {
  Sparkles,
  BookOpen,
  FileText,
  MessageCircle,
  Download,
  PanelRightClose,
  HelpCircle,
  ToggleRight,
  Layers,
  Zap,
  Plus,
} from 'lucide-react';

export default function NoteViewRightSidebar({ note, onCollapse, onExport }) {
  return (
    <aside className="note-view-right-sidebar">
      <div className="note-view-right-sidebar-header">
        <h2 className="note-view-right-sidebar-title">AI Assistant</h2>
        <div className="note-view-right-sidebar-header-actions">
          <button
            type="button"
            className="note-view-right-sidebar-btn note-view-right-sidebar-export"
            onClick={() => onExport?.()}
            aria-label="Export"
            title="Export"
          >
            <Download size={16} />
            Export
          </button>
          {onCollapse && (
            <button
              type="button"
              className="note-view-right-sidebar-collapse-btn"
              onClick={onCollapse}
              aria-label="Hide sidebar"
              title="Hide sidebar"
            >
              <PanelRightClose size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="note-view-right-sidebar-body">
        <section className="note-view-right-sidebar-section">
          <h3 className="note-view-right-sidebar-section-title">
            <Sparkles size={16} />
            AI Assistant
          </h3>
          <div className="note-view-right-sidebar-cards">
            <button
              type="button"
              className="note-view-right-sidebar-card"
              aria-label="Explain selected text"
              title="Explain This"
            >
              <span className="note-view-right-sidebar-card-icon">
                <BookOpen size={20} />
              </span>
              <span className="note-view-right-sidebar-card-title">Explain This</span>
              <span className="note-view-right-sidebar-card-desc">Deep dive into selected text</span>
            </button>
            <button
              type="button"
              className="note-view-right-sidebar-card"
              aria-label="Summarize note"
              title="Summarize"
            >
              <span className="note-view-right-sidebar-card-icon">
                <FileText size={20} />
              </span>
              <span className="note-view-right-sidebar-card-title">Summarize</span>
              <span className="note-view-right-sidebar-card-desc">Create a quick summary</span>
            </button>
            <button
              type="button"
              className="note-view-right-sidebar-card"
              aria-label="Chat with AI about this note"
              title="Chat with AI"
            >
              <span className="note-view-right-sidebar-card-icon">
                <MessageCircle size={20} />
              </span>
              <span className="note-view-right-sidebar-card-title">Chat with AI</span>
              <span className="note-view-right-sidebar-card-desc">Ask questions about this note</span>
            </button>
          </div>
        </section>
        <section className="note-view-right-sidebar-section">
          <h3 className="note-view-right-sidebar-section-title">Flashcards</h3>
          <div className="note-view-right-sidebar-flashcard-types">
            <button type="button" className="note-view-right-sidebar-flashcard-type" title="Multiple choice">
              <HelpCircle size={18} />
              <span>MCQ</span>
            </button>
            <button type="button" className="note-view-right-sidebar-flashcard-type" title="True or False">
              <ToggleRight size={18} />
              <span>True / False</span>
            </button>
            <button type="button" className="note-view-right-sidebar-flashcard-type" title="Flip card">
              <Layers size={18} />
              <span>Flip Card</span>
            </button>
          </div>
          <div className="note-view-right-sidebar-flashcard-actions">
            <button type="button" className="note-view-right-sidebar-btn note-view-right-sidebar-btn-primary">
              <Zap size={18} />
              Auto Generate
            </button>
            <button type="button" className="note-view-right-sidebar-btn note-view-right-sidebar-btn-secondary">
              <Plus size={18} />
              Manual Create
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
