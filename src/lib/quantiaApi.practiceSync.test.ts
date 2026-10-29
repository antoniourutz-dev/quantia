import { describe, expect, it } from 'vitest';
import { buildPracticeSessionSyncPayload } from './quantiaApi';
import type { ActivePracticeSession, PracticeMode, TestAnswer } from '../types';

const question = {
  id: 'q1',
  number: 1,
  text: 'Pregunta',
  options: [
    { id: 'a' as const, text: 'A' },
    { id: 'b' as const, text: 'B' },
  ],
  correctAnswer: 'b' as const,
  explanation: 'Explicación',
  syllabus: 'specific' as const,
  category: 'Tema 1',
  questionScope: 'specific' as const,
};

const answer: TestAnswer = {
  questionId: 'q1',
  selectedOption: 'a',
  correctOption: 'b',
  isCorrect: false,
  answeredAt: '2026-10-26T10:00:00.000Z',
  responseTimeMs: 1200,
  timeToFirstSelectionMs: 1200,
  changedAnswer: false,
};

describe('buildPracticeSessionSyncPayload', () => {
  it.each<PracticeMode>([
    'standard',
    'quick_five',
    'weakest',
    'random',
    'review',
    'mixed',
    'simulacro',
    'anti_trap',
    'custom',
  ])('preserva la modalidad %s y todos sus intentos', (mode) => {
    const session: ActivePracticeSession = {
      id: `session-${mode}`,
      mode,
      title: 'Test',
      startedAt: '2026-10-26T09:59:00.000Z',
      questions: [question],
      batchNumber: 1,
      totalBatches: 1,
      batchStartIndex: null,
      nextStandardBatchStartIndex: null,
    };

    const payload = buildPracticeSessionSyncPayload(
      session,
      [answer],
      'osakidetza_electromedicina',
    );

    expect(payload.session.mode).toBe(mode);
    expect(payload.session.batchSize).toBe(1);
    expect(payload.attempts).toEqual([
      expect.objectContaining({
        question_id: 'q1',
        selected_option: 'a',
        correct_option: 'b',
        is_correct: false,
      }),
    ]);
  });

  it('excludes questions without an assigned answer from the statistical payload', () => {
    const unscoredQuestion = { ...question, id: 'q-unscored', correctAnswer: null };
    const session: ActivePracticeSession = {
      id: 'session-unscored',
      mode: 'custom',
      title: 'Test',
      startedAt: '2026-10-29T09:00:00.000Z',
      questions: [unscoredQuestion],
      batchNumber: 1,
      totalBatches: 1,
      batchStartIndex: null,
      nextStandardBatchStartIndex: null,
    };

    const payload = buildPracticeSessionSyncPayload(session, [{
      ...answer,
      questionId: 'q-unscored',
      correctOption: null,
      isCorrect: false,
    }], 'osakidetza_mantenimiento_instalaciones');

    expect(payload.attempts).toEqual([]);
  });
});
