import { nanoid } from 'nanoid';
import { getBackendClient } from '../apiClient';
import { getNotes } from './noteService';
import { getFolders } from './folderService';

const CARDS_KEY = 'nexonote_flashcards_v2_cards';
const REVIEWS_KEY = 'nexonote_flashcards_v2_reviews';

function hasElectronFlashcards() {
  return typeof window !== 'undefined' && window.electronAPI?.flashcards;
}

function normalizeType(type) {
  if (type === 'mcq' || type === 'flip' || type === 'true_false') return type;
  if (type === 'tf') return 'true_false';
  if (type === 'true/false') return 'true_false';
  if (type === 'true-false') return 'true_false';
  if (type === 'multiple_choice') return 'mcq';
  return 'flip';
}

function toCard(raw) {
  const type = normalizeType(raw.type);
  const correctOptionIndex = raw.correctOptionIndex != null ? Number(raw.correctOptionIndex) : null;
  const options = Array.isArray(raw.options)
    ? raw.options.map((opt, index) => ({
        id: opt.id || nanoid(),
        text: String(opt.text || ''),
        order: Number.isFinite(Number(opt.order)) ? Number(opt.order) : index,
      }))
    : [];
  return {
    id: raw.id,
    deckId: null,
    deckTitle: raw.noteTitle || raw.deckTitle || 'Untitled',
    sourceNoteId: raw.sourceNoteId || raw.noteId || null,
    noteId: raw.noteId || raw.sourceNoteId || null,
    topicId: raw.topicId ?? null,
    type,
    prompt: raw.prompt ?? raw.questionText ?? '',
    back: raw.back ?? raw.answerText ?? '',
    correctAnswer: raw.correctAnswer == null ? null : !!raw.correctAnswer,
    correctOptionIndex: type === 'mcq' ? correctOptionIndex : null,
    options,
    explanation: raw.explanation ?? raw.explanationText ?? '',
    status: raw.status === 'SAVED' ? 'SAVED' : 'DRAFT',
    easinessFactor: Number.isFinite(Number(raw.easinessFactor)) ? Number(raw.easinessFactor) : 2.5,
    intervalDays: Number.isFinite(Number(raw.intervalDays)) ? Number(raw.intervalDays) : 0,
    repetitionCount: Number.isFinite(Number(raw.repetitionCount)) ? Number(raw.repetitionCount) : 0,
    lastReviewDate: raw.lastReviewDate || null,
    nextReviewDate: raw.nextReviewDate || null,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  };
}

function serializeCard(card) {
  return {
    ...card,
    createdAt: typeof card.createdAt === 'string' ? card.createdAt : card.createdAt?.toISOString?.(),
    updatedAt: typeof card.updatedAt === 'string' ? card.updatedAt : card.updatedAt?.toISOString?.(),
  };
}

async function getLocalCardsRaw() {
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCardsRaw(cards) {
  localStorage.setItem(CARDS_KEY, JSON.stringify(cards.map(serializeCard)));
}

export async function getFlashcards(filters = {}) {
  const backend = await getBackendClient();
  if (backend) {
    const list = await backend.flashcards.getAll(filters);
    return list.map(toCard);
  }
  if (hasElectronFlashcards()) {
    const list = await window.electronAPI.flashcards.getAll(filters);
    return list.map(toCard);
  }
  const all = (await getLocalCardsRaw()).map(toCard);
  return all
    .filter((card) => {
      if (filters.status && card.status !== filters.status) return false;
      if (filters.type && card.type !== normalizeType(filters.type)) return false;
      if (filters.sourceNoteId && card.sourceNoteId !== filters.sourceNoteId) return false;
      if (filters.noteId && card.sourceNoteId !== filters.noteId && card.noteId !== filters.noteId) return false;
      if (filters.topicId) {
        const cardTopicKey = card.topicId || card.noteId || card.sourceNoteId;
        if (cardTopicKey !== filters.topicId) return false;
      }
      if (filters.dueOnly) {
        if (!card.nextReviewDate || card.status !== 'SAVED') return false;
        const now = new Date(filters.now || new Date().toISOString());
        if (new Date(card.nextReviewDate) > now) return false;
      }
      return true;
    });
}

export async function getFlashcardLibrary() {
  const backend = await getBackendClient();
  if (backend) {
    return backend.flashcards.getLibrary();
  }
  if (hasElectronFlashcards() && window.electronAPI.flashcards.getLibrary) {
    return window.electronAPI.flashcards.getLibrary();
  }
  const [cards, notes] = await Promise.all([
    getFlashcards({}),
    getNotes(),
  ]);
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const byNote = new Map();
  const now = new Date();
  for (const card of cards) {
    const noteId = card.noteId || card.sourceNoteId;
    if (!noteId) continue;
    const note = noteById.get(noteId);
    if (!byNote.has(noteId)) {
      byNote.set(noteId, {
        noteId,
        title: note?.title || card.noteTitle || 'Untitled',
        tags: Array.isArray(note?.tags) ? note.tags : [],
        totalCards: 0,
        dueToday: 0,
      });
    }
    const bucket = byNote.get(noteId);
    bucket.totalCards += 1;
    if (card.status === 'SAVED' && card.nextReviewDate && new Date(card.nextReviewDate) <= now) {
      bucket.dueToday += 1;
    }
  }
  return Array.from(byNote.values()).sort((a, b) => b.totalCards - a.totalCards);
}

export async function getFlashcardById(id) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.flashcards.getById(id);
    return raw ? toCard(raw) : null;
  }
  if (hasElectronFlashcards()) {
    const raw = await window.electronAPI.flashcards.getById(id);
    return raw ? toCard(raw) : null;
  }
  const cards = await getFlashcards({});
  return cards.find((c) => c.id === id) || null;
}

export async function createFlashcard(payload) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.flashcards.create(payload);
    return toCard(raw);
  }
  if (hasElectronFlashcards()) {
    const raw = await window.electronAPI.flashcards.create(payload);
    return toCard(raw);
  }
  const cards = (await getLocalCardsRaw()).map(toCard);
  const noteId = payload.noteId || payload.sourceNoteId;
  if (!noteId) throw new Error('noteId is required');
  const note = (await getNotes()).find((n) => n.id === noteId);
  const now = new Date().toISOString();
  const type = normalizeType(payload.type);
  const options = Array.isArray(payload.options) ? payload.options : [];
  const correctOptionIndex = type === 'mcq'
    ? (
      payload.correctOptionIndex != null
        ? Number(payload.correctOptionIndex)
        : options.findIndex((o) => !!o.isCorrect)
    )
    : null;
  const card = toCard({
    ...payload,
    id: nanoid(),
    deckId: null,
    noteTitle: note?.title || 'Untitled',
    type,
    prompt: payload.prompt ?? payload.questionText ?? '',
    back: payload.back ?? payload.answerText ?? '',
    correctOptionIndex,
    correctAnswer: payload.correctAnswer,
    status: payload.status || 'SAVED',
    createdAt: now,
    updatedAt: now,
    nextReviewDate: payload.nextReviewDate || now,
  });
  cards.unshift(card);
  saveLocalCardsRaw(cards);
  return card;
}

export async function updateFlashcard(id, payload) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.flashcards.update(id, payload);
    return raw ? toCard(raw) : null;
  }
  if (hasElectronFlashcards()) {
    const raw = await window.electronAPI.flashcards.update(id, payload);
    return raw ? toCard(raw) : null;
  }
  const cards = (await getLocalCardsRaw()).map(toCard);
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const type = payload.type ? normalizeType(payload.type) : cards[idx].type;
  const next = toCard({
    ...cards[idx],
    ...payload,
    id,
    type,
    updatedAt: new Date().toISOString(),
  });
  cards[idx] = next;
  saveLocalCardsRaw(cards);
  return next;
}

export async function deleteFlashcard(id) {
  const backend = await getBackendClient();
  if (backend) {
    return backend.flashcards.delete(id);
  }
  if (hasElectronFlashcards()) {
    return window.electronAPI.flashcards.delete(id);
  }
  const cards = (await getLocalCardsRaw()).map(toCard);
  const next = cards.filter((c) => c.id !== id);
  if (next.length === cards.length) return false;
  saveLocalCardsRaw(next);
  return true;
}

export async function getDueFlashcards(filters = {}) {
  const backend = await getBackendClient();
  if (backend) {
    const list = await backend.flashcards.getDue(filters);
    return list.map(toCard);
  }
  if (hasElectronFlashcards()) {
    const list = await window.electronAPI.flashcards.getDue(filters);
    return list.map(toCard);
  }
  const now = new Date(filters.now || new Date().toISOString());
  const cards = await getFlashcards({ status: 'SAVED' });
  return cards.filter((card) => {
    if (!card.nextReviewDate) return false;
    if (filters.noteId && card.sourceNoteId !== filters.noteId && card.noteId !== filters.noteId) return false;
    if (filters.topicId) {
      const cardTopicKey = card.topicId || card.noteId || card.sourceNoteId;
      if (cardTopicKey !== filters.topicId) return false;
    }
    if (filters.type && card.type !== normalizeType(filters.type)) return false;
    return new Date(card.nextReviewDate) <= now;
  });
}

export async function getPerformanceAnalytics({ days = 30, now = null } = {}) {
  const backend = await getBackendClient();
  if (backend) {
    return backend.flashcards.getPerformanceAnalytics({ days, now });
  }
  if (hasElectronFlashcards() && window.electronAPI.flashcards.getPerformanceAnalytics) {
    return window.electronAPI.flashcards.getPerformanceAnalytics({ days, now });
  }

  const windowDays = Math.max(1, Number(days) || 30);
  const endDate = now ? new Date(now) : new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - windowDays);

  const [cards, notes, folders] = await Promise.all([
    getFlashcards({ status: 'SAVED' }),
    getNotes(),
    getFolders(),
  ]);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const folderById = new Map(folders.map((f) => [f.id, f]));

  let reviews = [];
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    reviews = raw ? JSON.parse(raw) : [];
  } catch {
    reviews = [];
  }

  const buckets = new Map();
  for (const card of cards) {
    const topicId = card.topicId || card.noteId || card.sourceNoteId;
    if (!topicId || buckets.has(topicId)) continue;
    const note = noteById.get(card.noteId || card.sourceNoteId);
    const folder = folderById.get(card.topicId);
    buckets.set(topicId, {
      topicId,
      topicName: folder?.name || note?.title || 'Untitled Topic',
      totalReviews: 0,
      correctReviews: 0,
    });
  }

  for (const review of reviews) {
    const reviewedAt = new Date(review.reviewedAt);
    if (Number.isNaN(reviewedAt.getTime())) continue;
    if (reviewedAt < startDate || reviewedAt > endDate) continue;

    const cardId = review.cardId || review.flashcardId;
    const card = cardById.get(cardId);
    if (!card) continue;

    const topicId = card.topicId || card.noteId || card.sourceNoteId;
    if (!topicId) continue;
    if (!buckets.has(topicId)) {
      const note = noteById.get(card.noteId || card.sourceNoteId);
      const folder = folderById.get(card.topicId);
      buckets.set(topicId, {
        topicId,
        topicName: folder?.name || note?.title || 'Untitled Topic',
        totalReviews: 0,
        correctReviews: 0,
      });
    }
    const bucket = buckets.get(topicId);
    bucket.totalReviews += 1;
    if (String(review.result || '').toLowerCase() === 'correct') {
      bucket.correctReviews += 1;
    }
  }

  const topics = Array.from(buckets.values()).map((item) => {
    const masteryPercent = item.totalReviews > 0
      ? Number(((item.correctReviews / item.totalReviews) * 100).toFixed(1))
      : 0;
    const category = item.totalReviews === 0
      ? 'No Data'
      : masteryPercent >= 80
        ? 'Mastery'
        : masteryPercent >= 60
          ? 'Review Needed'
          : 'Critical';
    return {
      ...item,
      masteryPercent,
      category,
      noData: item.totalReviews === 0,
    };
  }).sort((a, b) => a.topicName.localeCompare(b.topicName));

  const weakTopics = topics
    .filter((t) => t.masteryPercent < 60 && t.totalReviews >= 3)
    .sort((a, b) => a.masteryPercent - b.masteryPercent || b.totalReviews - a.totalReviews);

  return {
    windowDays,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    topics,
    weakTopics,
  };
}

export async function reviewFlashcard(id, rating, reviewedAt = null, reviewMeta = {}) {
  const backend = await getBackendClient();
  if (backend) {
    const raw = await backend.flashcards.review(id, rating, reviewedAt, reviewMeta);
    return {
      flashcard: toCard(raw.flashcard),
      scheduling: raw.scheduling,
    };
  }
  if (hasElectronFlashcards()) {
    const raw = await window.electronAPI.flashcards.review(id, rating, reviewedAt, reviewMeta);
    return {
      flashcard: toCard(raw.flashcard),
      scheduling: raw.scheduling,
    };
  }
  const cards = (await getLocalCardsRaw()).map(toCard);
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Flashcard not found');
  const card = cards[idx];
  const score = Math.max(0, Math.min(5, Math.round(Number(rating))));
  let repetition = card.repetitionCount;
  let interval = card.intervalDays;
  if (score < 3) {
    repetition = 0;
    interval = 1;
  } else {
    repetition += 1;
    if (repetition === 1) interval = 1;
    else if (repetition === 2) interval = 6;
    else interval = Math.round(interval * card.easinessFactor);
  }
  let ef = card.easinessFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
  if (ef < 1.3) ef = 1.3;
  ef = Number(ef.toFixed(4));
  const reviewedAtIso = reviewedAt || new Date().toISOString();
  const difficulty = String(reviewMeta?.difficulty || '').trim().toLowerCase();
  const nextReview = new Date(reviewedAtIso);
  if (difficulty === 'again') {
    // Immediate due for retry.
  } else if (difficulty === 'hard') {
    nextReview.setUTCHours(nextReview.getUTCHours() + 3);
  } else if (difficulty === 'good') {
    nextReview.setUTCDate(nextReview.getUTCDate() + 1);
  } else if (difficulty === 'easy') {
    nextReview.setUTCDate(nextReview.getUTCDate() + 2);
  } else {
    nextReview.setUTCDate(nextReview.getUTCDate() + interval);
  }
  cards[idx] = toCard({
    ...card,
    easinessFactor: ef,
    intervalDays: interval,
    repetitionCount: repetition,
    lastReviewDate: reviewedAtIso,
    nextReviewDate: nextReview.toISOString(),
    updatedAt: reviewedAtIso,
    status: 'SAVED',
  });
  saveLocalCardsRaw(cards);
  const entry = {
    id: nanoid(),
    cardId: id,
    reviewedAt: reviewedAtIso,
    result: reviewMeta.result || null,
    difficulty: reviewMeta.difficulty || null,
    responseTimeMs: Number.isFinite(Number(reviewMeta.responseTimeMs)) ? Number(reviewMeta.responseTimeMs) : null,
    rating: score,
  };
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(entry);
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return {
    flashcard: cards[idx],
    scheduling: {
      nextEf: ef,
      nextInterval: interval,
      nextRepetition: repetition,
      nextReviewDate: cards[idx].nextReviewDate,
      rating: score,
    },
  };
}
