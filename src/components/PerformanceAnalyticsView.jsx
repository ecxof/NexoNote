import { AlertTriangle, BarChart3, CircleDot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPerformanceAnalytics } from '../services/flashcardService';

function toTone(category) {
  if (category === 'Mastery') return 'good';
  if (category === 'Review Needed') return 'warning';
  if (category === 'No Data') return 'no-data';
  return 'critical';
}

export default function PerformanceAnalyticsView({ refreshKey = 0, onStartReviewSession }) {
  const [analytics, setAnalytics] = useState({ topics: [], weakTopics: [], windowDays: 30 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await getPerformanceAnalytics({ days: 30 });
      if (mounted) {
        setAnalytics(data || { topics: [], weakTopics: [], windowDays: 30 });
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const topics = Array.isArray(analytics.topics) ? analytics.topics : [];
  const weakTopics = Array.isArray(analytics.weakTopics) ? analytics.weakTopics : [];
  const noDataTopics = topics.filter((t) => t.totalReviews === 0);

  return (
    <section className="performance-view">
      <header className="performance-view-header">
        <h1 className="performance-view-title">Performance Analytics</h1>
        <p className="performance-view-subtitle">
          Deep dive into your flashcard retention and mastery levels.
        </p>
      </header>

      <div className="performance-layout">
        <article className="performance-panel performance-panel-chart">
          <h2 className="performance-panel-title">
            <BarChart3 size={18} />
            Topic Mastery
          </h2>
          <p className="performance-panel-subtitle">
            Calculated from review history (last {analytics.windowDays || 30} days)
          </p>
          <div className="performance-legend">
            <span><CircleDot size={12} /> Mastery (80%+)</span>
            <span><CircleDot size={12} /> Review Needed (60-79%)</span>
            <span><CircleDot size={12} /> Poor Performance (&lt;60%)</span>
            <span><CircleDot size={12} /> No Data (0 reviews)</span>
          </div>
          <p className="performance-description">
            Mastery percent = correct reviews / total reviews in the last 30 days.
          </p>

          <div className="mastery-chart">
            <div className="mastery-grid" />
            <div className="mastery-bars">
              {loading ? (
                <p className="performance-panel-subtitle">Loading analytics...</p>
              ) : topics.length === 0 ? (
                <p className="performance-panel-subtitle">No review data in the last 30 days.</p>
              ) : topics.map((topic) => (
                <div className="mastery-column" key={topic.topicId}>
                  <div
                    className={`mastery-bar mastery-bar-${toTone(topic.category)}`}
                    style={{ height: `${topic.masteryPercent}%` }}
                    aria-label={`${topic.topicName} mastery ${topic.masteryPercent}%`}
                  />
                  <span className="mastery-label">{topic.topicName}</span>
                </div>
              ))}
            </div>
            <div className="mastery-y-axis">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
          </div>
          {!loading && noDataTopics.length > 0 && (
            <p className="performance-no-data">
              No data in last 30 days: {noDataTopics.map((t) => t.topicName).join(', ')}
            </p>
          )}
        </article>

        <aside className="performance-panel performance-panel-weak">
          <h2 className="performance-panel-title">
            <AlertTriangle size={18} />
            Weak Topics
          </h2>
          <p className="performance-panel-subtitle">
            Topics requiring additional review (&lt; 60% mastery, 3+ reviews)
          </p>

          <div className="weak-topic-list">
            {loading ? (
              <p className="performance-panel-subtitle">Loading weak topics...</p>
            ) : weakTopics.length === 0 ? (
              <p className="performance-panel-subtitle">No weak topics in the last 30 days.</p>
            ) : weakTopics.map((topic) => (
              <article className="weak-topic-card" key={topic.topicId}>
                <div className="weak-topic-head">
                  <h3>{topic.topicName}</h3>
                  <strong>{topic.masteryPercent}%</strong>
                </div>
                <p>{topic.correctReviews}/{topic.totalReviews} correct in last 30 days</p>
                <footer className="weak-topic-footer">
                  <span className={`weak-topic-badge ${topic.category === 'Critical' ? 'critical' : ''}`}>
                    {topic.category}
                  </span>
                  <button
                    type="button"
                    className="weak-topic-review-btn"
                    onClick={() => onStartReviewSession?.({ topicId: topic.topicId, dueOnly: false })}
                  >
                    Review
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
