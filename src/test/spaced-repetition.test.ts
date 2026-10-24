import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateNextReview,
  getDueFlashcards,
  generateFlashcardsWithAi,
  getCuratedTopicResources,
} from '../lib/spacedRepetition';
import type { FlashcardItem } from '../lib/types';
import { callAi } from '../lib/ai';

vi.mock('../lib/ai', () => ({
  callAi: vi.fn(),
}));

describe('Spaced Repetition SM-2 Algorithm', () => {
  const baseCard: FlashcardItem = {
    id: 'fc_test_1',
    roadmap_id: 'rd_test',
    topic_title: 'Goroutines and Channels',
    question: 'Goroutine nima va uning OS threadlardan farqi nimada?',
    answer: 'Goroutine bu Go runtime tomonidan boshqariladigan juda yengil (2KB) ko-protses.',
    explanation: 'OS thread 1-2MB xotira talab qilsa, goroutine atigi 2KB dan boshlanadi.',
    code_snippet: 'go func() {\n  fmt.Println("Hello")\n}()',
    interval_days: 1,
    repetition_count: 0,
    ease_factor: 2.5,
    next_review_date: '2026-10-24',
    created_at: '2026-10-24T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Rating 1 (Qiyin / Again) resets interval to 1 day and drops ease factor', () => {
    const matureCard: FlashcardItem = {
      ...baseCard,
      interval_days: 14,
      repetition_count: 3,
      ease_factor: 2.5,
    };
    const reviewDate = new Date('2026-10-24T12:00:00Z');
    const result = calculateNextReview(matureCard, 1, reviewDate);

    expect(result.interval_days).toBe(1);
    expect(result.repetition_count).toBe(0);
    expect(result.ease_factor).toBe(2.3);
    expect(result.next_review_date).toBe('2026-10-25');
  });

  it('Rating 2 (Yaxshi / Good) advances progression sequentially (1 -> 3 -> interval * ease)', () => {
    const reviewDate = new Date('2026-10-24T12:00:00Z');

    // First review
    const rep0 = calculateNextReview(baseCard, 2, reviewDate);
    expect(rep0.interval_days).toBe(1);
    expect(rep0.repetition_count).toBe(1);
    expect(rep0.next_review_date).toBe('2026-10-25');

    // Second review
    const cardRep1: FlashcardItem = {
      ...baseCard,
      interval_days: rep0.interval_days,
      repetition_count: rep0.repetition_count,
    };
    const rep1 = calculateNextReview(cardRep1, 2, reviewDate);
    expect(rep1.interval_days).toBe(3);
    expect(rep1.repetition_count).toBe(2);
    expect(rep1.next_review_date).toBe('2026-10-27');

    // Third review
    const cardRep2: FlashcardItem = {
      ...baseCard,
      interval_days: rep1.interval_days,
      repetition_count: rep1.repetition_count,
    };
    const rep2 = calculateNextReview(cardRep2, 2, reviewDate);
    // 3 * 2.5 = 7.5 -> 8 days
    expect(rep2.interval_days).toBe(8);
    expect(rep2.repetition_count).toBe(3);
    expect(rep2.next_review_date).toBe('2026-11-01');
  });

  it('Rating 3 (Oson / Easy) gives bonus interval and boosts ease factor', () => {
    const reviewDate = new Date('2026-10-24T12:00:00Z');
    const res = calculateNextReview(baseCard, 3, reviewDate);

    expect(res.interval_days).toBe(2);
    expect(res.repetition_count).toBe(1);
    expect(res.ease_factor).toBe(2.65);
    expect(res.next_review_date).toBe('2026-10-26');
  });

  it('getDueFlashcards filters cards due today or overdue', () => {
    const targetDate = new Date('2026-10-24T12:00:00Z');
    const cards: FlashcardItem[] = [
      { ...baseCard, id: '1', next_review_date: '2026-10-23' }, // Overdue
      { ...baseCard, id: '2', next_review_date: '2026-10-24' }, // Due today
      { ...baseCard, id: '3', next_review_date: '2026-10-25' }, // Future
    ];

    const due = getDueFlashcards(cards, targetDate);
    expect(due.map((c) => c.id)).toEqual(['1', '2']);
  });

  it('generateFlashcardsWithAi successfully parses AI-generated JSON cards', async () => {
    vi.mocked(callAi).mockResolvedValueOnce({
      text: JSON.stringify([
        {
          question: 'B-Tree nima?',
          answer: 'Muvozanatlangan qidiruv daraxti.',
          explanation: 'Disk I/O amallarini minimallashtiradi.',
          code_snippet: 'CREATE INDEX idx ON users (email);',
        },
      ]),
      source: 'gemini',
      model: 'gemini-1.5-pro',
    });

    const drafts = await generateFlashcardsWithAi('Database Indexing B-Tree', 'Backend Roadmap', 'PostgreSQL');
    expect(drafts.length).toBe(1);
    expect(drafts[0].topic_title).toBe('Database Indexing B-Tree');
    expect(drafts[0].question).toBe('B-Tree nima?');
    expect(drafts[0].answer).toBe('Muvozanatlangan qidiruv daraxti.');
    expect(drafts[0].code_snippet).toBe('CREATE INDEX idx ON users (email);');
  });

  it('generateFlashcardsWithAi returns quality fallback questions when AI call fails', async () => {
    vi.mocked(callAi).mockRejectedValueOnce(new Error('Network offline in unit test'));

    const drafts = await generateFlashcardsWithAi('Database Indexing B-Tree', 'Backend Roadmap', 'PostgreSQL');
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    expect(drafts[0].topic_title).toBe('Database Indexing B-Tree');
    expect(drafts[0].question.length).toBeGreaterThan(10);
    expect(drafts[0].answer.length).toBeGreaterThan(10);
  });

  it('getCuratedTopicResources produces documentation, repo, and cheat sheet links', async () => {
    const resources = await getCuratedTopicResources('Docker Containers', 'DevOps');
    expect(resources.length).toBe(3);
    expect(resources[0].type).toBe('doc');
    expect(resources[1].type).toBe('repo');
    expect(resources[2].type).toBe('guide');
    expect(resources[0].url).toContain('devdocs.io');
    expect(resources[1].url).toContain('github.com');
  });
});
