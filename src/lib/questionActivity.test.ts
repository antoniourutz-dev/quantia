import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../types';

const { upsertMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: upsertMock,
    })),
  },
}));

import {
  getPendingQuestionActivity,
  getQuestionActivity,
  recordQuestionAnswer,
  recordQuestionView,
  syncQuestionActivity,
} from './questionActivity';

describe('questionActivity', () => {
  const context = {
    userId: '00000000-0000-0000-0000-000000000001',
    curriculum: 'osakidetza_electromedicina',
  };
  const question = {
    id: 'question-1',
    number: 1,
    text: 'Pregunta',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
      { id: 'd', text: 'D' },
    ],
    correctAnswer: 'b',
    explanation: '',
    syllabus: 'specific',
    category: null,
    questionScope: 'specific',
  } as Question;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('usa localStorage solo como cola y elimina la respuesta tras persistirla en Supabase', async () => {
    recordQuestionView({
      ...context,
      eventId: 'session-1:test:question-1:1',
      sessionId: 'session-1',
      surface: 'test',
      mode: 'standard',
      question,
    });

    expect(getPendingQuestionActivity(context)).toHaveLength(1);
    await syncQuestionActivity(context);
    expect(getPendingQuestionActivity(context)).toHaveLength(0);
    expect(getQuestionActivity(context)).toEqual([
      expect.objectContaining({ eventId: 'session-1:test:question-1:1', pending: false, isCorrect: null }),
    ]);

    recordQuestionAnswer({
      ...context,
      eventId: 'session-1:test:question-1:1',
      isCorrect: true,
    });
    expect(getPendingQuestionActivity(context)).toHaveLength(1);

    await syncQuestionActivity(context);

    expect(getQuestionActivity(context)).toEqual([]);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({
        event_id: 'session-1:test:question-1:1',
        is_correct: true,
      }),
    ]);
  });
});
