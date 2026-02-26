/**
 * Right sidebar: AI Chatbot assistant for the current note, plus Flashcards.
 * Provides streaming chat with Hugging Face, quick actions (Explain This, Summarize, Quiz Me), and note-context awareness.
 */
import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  Sparkles,
  BookOpen,
  FileText,
  MessageCircle,
  Download,
  PanelRightClose,
  Send,
  RotateCcw,
  AlertTriangle,
  Bot,
  User,
  Plus,
  Plus,
  Search,
} from 'lucide-react';
import { sendChatMessage } from '../services/chatService';

/** Simple markdown-like formatting for AI responses */
function formatMessage(text) {
  if (!text) return '';
  return text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

const QUICK_ACTIONS = [
  {
    id: 'explain',
    icon: BookOpen,
    label: 'Explain This',
    desc: 'Deep dive into note content',
    prompt: 'Please explain the key concepts in my notes in a clear and detailed way. Break down any complex ideas into simpler terms.',
  },
  {
    id: 'summarize',
    icon: FileText,
    label: 'Summarize',
    desc: 'Create a quick summary',
    prompt: 'Please provide a concise summary of my notes. Highlight the most important points and key takeaways.',
  },
  {
    id: 'chat',
    icon: MessageCircle,
    label: 'Quiz Me',
    desc: 'Test your understanding',
    prompt: 'Based on my notes, ask me 3 quiz questions to test my understanding. Start with the first question and wait for my answer before proceeding.',
  },
];

const NoteViewRightSidebar = forwardRef(function NoteViewRightSidebar({
  note,
  onCollapse,
  onExport,
  onManualCreateFlashcard,
}, ref) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;

    const userMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setIsStreaming(true);

    // Add an empty assistant message placeholder
    const assistantMsg = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    try {
      abortControllerRef.current = new AbortController();

      await sendChatMessage(
        newMessages,
        note?.content || '',
        note?.title || '',
        (_chunk, fullText) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: fullText };
            return updated;
          });
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to get response from AI');
      // Remove the empty assistant message on error
      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant' && !updated[updated.length - 1].content) {
          updated.pop();
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [messages, isStreaming, note?.content, note?.title]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    handleSendMessage(input);
  }, [input, handleSendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  }, [input, handleSendMessage]);

  const handleQuickAction = useCallback((prompt) => {
    handleSendMessage(prompt);
  }, [handleSendMessage]);

  const handleNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setInput('');
    inputRef.current?.focus();
  }, []);

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  }, []);

  useImperativeHandle(ref, () => ({
    triggerAsk(text) {
      handleSendMessage(text);
    }
  }), [handleSendMessage]);

  const hasMessages = messages.length > 0;

  return (
    <aside className="note-view-right-sidebar">
      {/* Header */}
      <div className="note-view-right-sidebar-header">
        <div className="ai-chat-header-left">
          <Sparkles size={18} className="ai-chat-header-icon" />
          <h2 className="note-view-right-sidebar-title">AI Assistant</h2>
        </div>
        <div className="note-view-right-sidebar-header-actions">
          {hasMessages && (
            <button
              type="button"
              className="ai-chat-new-btn"
              onClick={handleNewChat}
              title="New conversation"
              aria-label="New conversation"
            >
              <RotateCcw size={15} />
              New Chat
            </button>
          )}
          {onExport && (
            <button
              type="button"
              className="note-view-right-sidebar-btn note-view-right-sidebar-export"
              onClick={() => onExport?.()}
              aria-label="Export"
              title="Export"
            >
              <Download size={16} />
            </button>
          )}
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

      {/* Chat body */}
      <div className="ai-chat-body">
        {!hasMessages ? (
          /* Welcome screen with quick actions */
          <div className="ai-chat-welcome">
            <div className="ai-chat-welcome-icon">
              <Sparkles size={32} />
            </div>
            <h3 className="ai-chat-welcome-title">How can I help?</h3>
            <p className="ai-chat-welcome-desc">
              Ask me anything about your notes. I can explain concepts, create summaries, or quiz you on the material.
            </p>
            <div className="ai-chat-quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="ai-chat-quick-action"
                  onClick={() => handleQuickAction(action.prompt)}
                  title={action.label}
                >
                  <action.icon size={18} className="ai-chat-quick-action-icon" />
                  <div className="ai-chat-quick-action-text">
                    <span className="ai-chat-quick-action-label">{action.label}</span>
                    <span className="ai-chat-quick-action-desc">{action.desc}</span>
                  </div>
                </button>
              ))}
            </div>
            <p className="ai-chat-disclaimer">
              <AlertTriangle size={12} />
              AI responses may contain inaccuracies. Always verify important information.
            </p>
          </div>
        ) : (
          /* Message list */
          <div className="ai-chat-messages">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`ai-chat-message ai-chat-message-${msg.role}`}
              >
                <div className="ai-chat-message-avatar">
                  {msg.role === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>
                <div className="ai-chat-message-content">
                  {msg.role === 'assistant' && !msg.content && isStreaming ? (
                    <div className="ai-chat-typing">
                      <span className="ai-chat-typing-dot" />
                      <span className="ai-chat-typing-dot" />
                      <span className="ai-chat-typing-dot" />
                    </div>
                  ) : (
                    <div
                      className="ai-chat-message-text"
                      dangerouslySetInnerHTML={{
                        __html: msg.role === 'assistant'
                          ? formatMessage(msg.content)
                          : msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>'),
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            {error && (
              <div className="ai-chat-error">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <form className="ai-chat-input-area" onSubmit={handleSubmit}>
        <div className="ai-chat-input-wrap">
          <textarea
            ref={inputRef}
            className="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response...' : 'Ask about your notes...'}
            disabled={isStreaming}
            rows={1}
            aria-label="Chat message input"
          />
          {isStreaming ? (
            <button
              type="button"
              className="ai-chat-stop-btn"
              onClick={handleStopStreaming}
              title="Stop generating"
              aria-label="Stop generating"
            >
              <div className="ai-chat-stop-icon" />
            </button>
          ) : (
            <button
              type="submit"
              className="ai-chat-send-btn"
              disabled={!input.trim()}
              title="Send message"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>

      {/* Flashcards section (preserved from target) */}
      {onManualCreateFlashcard && (
        <div className="note-view-right-sidebar-flashcard-section">
          <section className="note-view-right-sidebar-section">
            <h3 className="note-view-right-sidebar-section-title">Flashcards</h3>
            <div className="note-view-right-sidebar-flashcard-actions">
              <button
                type="button"
                className="note-view-right-sidebar-btn note-view-right-sidebar-btn-primary"
                onClick={() => onManualCreateFlashcard?.(note)}
                disabled={!note}
              >
                <Plus size={18} />
                Create Flashcards
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
});

export default NoteViewRightSidebar;
