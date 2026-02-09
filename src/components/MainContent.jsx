import { Plus, Upload, BookOpen, ArrowRight } from 'lucide-react';

function MainContent() {
  // Dummy data for Recent Notes
  const recentNotes = [
    {
      id: 1,
      category: 'Operating Systems 101',
      categoryColor: '#3b82f6', // Blue
      title: 'Deadlock Prevention Strategies',
      preview: 'Understanding different strategies to prevent deadlocks in concurrent systems, including resource allocation...',
      timeAgo: '2m ago',
      tags: ['#OS', '#Exam'],
    },
    {
      id: 2,
      category: 'Intro to AI',
      categoryColor: '#10b981', // Green
      title: 'Neural Networks Fundamentals',
      preview: 'A comprehensive guide to understanding the basic principles of artificial neural networks and how they learn...',
      timeAgo: '45m ago',
      tags: ['#ML', '#AI'],
    },
    {
      id: 3,
      category: 'Databases',
      categoryColor: '#f59e0b', // Amber
      title: 'SQL Query Optimization',
      preview: 'Techniques and best practices for optimizing SQL queries to improve database performance and reduce query execution times...',
      timeAgo: '1h ago',
      tags: ['#Database', '#SQL'],
    },
    {
      id: 4,
      category: 'History of Art',
      categoryColor: '#ec4899', // Pink
      title: 'Renaissance Movement Overview',
      preview: 'Exploring the Renaissance period, its key characteristics, influential artists, and the cultural impact on modern art...',
      timeAgo: '3h ago',
      tags: ['#History', '#Art'],
    },
  ];

  return (
    <main className="main-content">
      {/* Header Section */}
      <div className="main-content-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-greeting">Good evening, Alex</h1>
            <p className="header-subtitle">Ready to get back to work?</p>
          </div>
          <div className="header-right">
            <button className="btn-primary">
              <Plus size={20} />
              Create New Note
            </button>
            <button className="btn-secondary">
              <Upload size={20} />
              Import File
            </button>
          </div>
        </div>
      </div>

      {/* Hero Card - Flashcard Review */}
      <div className="hero-card">
        <div className="hero-card-left">
          <BookOpen size={48} className="hero-icon" />
          <div className="hero-content">
            <h2 className="hero-title">Review Flashcards</h2>
            <p className="hero-subtitle">You have 0 cards due for review today.</p>
          </div>
        </div>
        <button className="btn-hero">
          Start Session
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Recent Notes Section */}
      <div className="recent-notes-section">
        <div className="recent-notes-header">
          <h2 className="recent-notes-title">Recent Notes</h2>
          <a href="#" className="view-all-link">View all &gt;</a>
        </div>

        <div className="recent-notes-grid">
          {recentNotes.map((note) => (
            <div key={note.id} className="note-card">
              {/* Card Header */}
              <div className="note-card-header">
                <div className="note-category">
                  <span
                    className="category-dot"
                    style={{ backgroundColor: note.categoryColor }}
                  ></span>
                  <span className="category-name">{note.category}</span>
                </div>
                <span className="note-time">{note.timeAgo}</span>
              </div>

              {/* Card Content */}
              <div className="note-card-content">
                <h3 className="note-title">{note.title}</h3>
                <p className="note-preview">{note.preview}</p>
              </div>

              {/* Card Footer - Tags */}
              <div className="note-card-footer">
                {note.tags.map((tag, index) => (
                  <span key={index} className="note-tag">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default MainContent;
