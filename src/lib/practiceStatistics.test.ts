import { describe, expect, it } from 'vitest';
import type { PracticeSessionSummary } from '../types';
import { calculateActiveDayStreak, calculateWeightedAccuracy, mergePracticeSessionHistory, type PracticeActivitySummaryRow } from './practiceStatistics';

const activity = (overrides: Partial<PracticeActivitySummaryRow> = {}): PracticeActivitySummaryRow => ({
  sessionId: 'activity-only', questionId: 'q1', mode: 'custom', surface: 'test',
  viewedAt: '2026-10-26T08:59:00.000Z', answeredAt: '2026-10-26T09:00:00.000Z', isCorrect: true, ...overrides,
});

describe('mergePracticeSessionHistory', () => {
  it('keeps completed sessions authoritative and adds activity-only tests', () => {
    const completed: PracticeSessionSummary = { id: 'completed', mode: 'standard', title: 'Test por temario', startedAt: '2026-10-25T09:00:00.000Z', finishedAt: '2026-10-25T09:10:00.000Z', score: 8, total: 10 };
    const result = mergePracticeSessionHistory([completed], [
      activity({ sessionId: 'completed', questionId: 'q1', isCorrect: false }),
      activity({ sessionId: 'activity-only', questionId: 'q1', isCorrect: true }),
      activity({ sessionId: 'activity-only', questionId: 'q2', isCorrect: false }),
    ]);
    expect(result.find((row) => row.id === 'completed')).toMatchObject({ score: 8, total: 10 });
    expect(result.find((row) => row.id === 'activity-only')).toMatchObject({ mode: 'custom', score: 1, total: 2 });
  });

  it('uses only the latest answer for a repeated question', () => {
    const result = mergePracticeSessionHistory([], [
      activity({ isCorrect: false, answeredAt: '2026-10-26T09:00:00.000Z' }),
      activity({ isCorrect: true, answeredAt: '2026-10-26T09:05:00.000Z' }),
    ]);
    expect(result[0]).toMatchObject({ score: 1, total: 1 });
  });

  it('ignores study and mistake-review activity', () => {
    expect(mergePracticeSessionHistory([], [activity({ surface: 'study' }), activity({ surface: 'mistake-review' })])).toEqual([]);
  });
});

describe('calculateActiveDayStreak', () => {
  it('counts consecutive local calendar days from today', () => {
    expect(calculateActiveDayStreak(['2026-10-27', '2026-10-26', '2026-10-25'], new Date(2026, 9, 27, 23))).toBe(3);
  });
  it('allows today to be pending but resets after a full missed day', () => {
    expect(calculateActiveDayStreak(['2026-10-26', '2026-10-25'], new Date(2026, 9, 27, 8))).toBe(2);
    expect(calculateActiveDayStreak(['2026-10-25'], new Date(2026, 9, 27, 8))).toBe(0);
  });
});

describe('calculateWeightedAccuracy', () => {
  it('weights precision by questions instead of averaging session percentages', () => {
    expect(calculateWeightedAccuracy([{ score: 1, total: 1 }, { score: 0, total: 9 }])).toBe(10);
  });
});
