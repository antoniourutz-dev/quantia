import { describe, expect, it } from 'vitest';
import type { PracticeSessionSummary } from '../types';
import {
  buildEvolutionChartData,
  buildFocusVsMixedSummary,
  buildModeDistribution,
  buildStatsAttemptTelemetry,
  buildSyllabusSummaries,
  classifyPracticeSessionKind,
  mergeTopicInsights,
} from './statsInsights';

const session = (overrides: Partial<PracticeSessionSummary> = {}): PracticeSessionSummary => ({
  id: 's1',
  mode: 'standard',
  title: 'Test',
  startedAt: '2026-11-20T10:00:00.000Z',
  finishedAt: '2026-11-20T10:20:00.000Z',
  score: 16,
  total: 20,
  ...overrides,
});

describe('classifyPracticeSessionKind & buildModeDistribution', () => {
  it('distinguishes Temas, Desafío and A tu medida even when all store mode=custom', () => {
    expect(classifyPracticeSessionKind(session({ mode: 'custom', title: 'Temas · Tema 1' }))).toBe('topics');
    expect(classifyPracticeSessionKind(session({ mode: 'custom', title: 'Desafío · Común + Específico' }))).toBe('challenge');
    expect(classifyPracticeSessionKind(session({ mode: 'custom', title: 'A tu medida · Ley 39/2015' }))).toBe('custom');
    expect(classifyPracticeSessionKind(session({ mode: 'review', title: 'Corregir fallos' }))).toBe('review');
  });

  it('weights mode share by questions rather than session count', () => {
    const dist = buildModeDistribution([
      session({ id: '1', mode: 'quick_five', title: 'Test rapido', score: 5, total: 5 }),
      session({ id: '2', mode: 'quick_five', title: 'Test rapido', score: 4, total: 5 }),
      session({ id: '3', mode: 'custom', title: 'Desafío · Mixto', score: 60, total: 90 }),
    ]);

    expect(dist[0]).toMatchObject({ kind: 'challenge', questions: 90, sharePct: 90, accuracyPct: 67 });
    expect(dist[1]).toMatchObject({ kind: 'quick_five', questions: 10, sessions: 2, sharePct: 10, accuracyPct: 90 });
  });
});

describe('buildFocusVsMixedSummary', () => {
  it('computes focused vs mixed transfer without any simulacro sessions', () => {
    const summary = buildFocusVsMixedSummary([
      session({ id: 'f1', mode: 'custom', title: 'Temas · Tema 1', score: 18, total: 20 }),
      session({ id: 'f2', mode: 'review', title: 'Corregir fallos', score: 16, total: 20 }),
      session({ id: 'm1', mode: 'custom', title: 'Desafío · Mixto', score: 30, total: 50 }),
    ]);

    expect(summary.enoughData).toBe(true);
    expect(summary.focusedAccuracy).toBe(85);
    expect(summary.mixedAccuracy).toBe(60);
    expect(summary.gapPp).toBe(-25);
  });
});

describe('buildStatsAttemptTelemetry', () => {
  it('computes topic evolution, error recovery, scoped daily and non-simulacro fatigue/precipitation', () => {
    const bank = [
      { id: 'q1', number: 1, scope: 'common' as const, category: 'Tema 1' },
      { id: 'q2', number: 2, scope: 'common' as const, category: 'Tema 1' },
      { id: 'q3', number: 3, scope: 'specific' as const, category: 'Tema 6' },
    ];

    const attempts = [
      // Tema 1 improving: first 3 wrong, last 3 right
      { eventId: 'e1', sessionId: 's-long', questionId: 'q1', questionNumber: 1, scope: 'common' as const, answeredAt: '2026-11-10T10:00:00.000Z', isCorrect: false, responseTimeMs: 1800, changedAnswer: false },
      { eventId: 'e2', sessionId: 's-long', questionId: 'q2', questionNumber: 2, scope: 'common' as const, answeredAt: '2026-11-10T10:01:00.000Z', isCorrect: false, responseTimeMs: 4000, changedAnswer: true },
      { eventId: 'e3', sessionId: 's-long', questionId: 'q1', questionNumber: 1, scope: 'common' as const, answeredAt: '2026-11-11T10:00:00.000Z', isCorrect: false, responseTimeMs: 5000, changedAnswer: false },
      { eventId: 'e4', sessionId: 's-long', questionId: 'q1', questionNumber: 1, scope: 'common' as const, answeredAt: '2026-11-18T10:00:00.000Z', isCorrect: true, responseTimeMs: 5000, changedAnswer: false },
      { eventId: 'e5', sessionId: 's-long', questionId: 'q1', questionNumber: 1, scope: 'common' as const, answeredAt: '2026-11-19T10:00:00.000Z', isCorrect: true, responseTimeMs: 5000, changedAnswer: false },
      { eventId: 'e6', sessionId: 's-long', questionId: 'q2', questionNumber: 2, scope: 'common' as const, answeredAt: '2026-11-19T10:01:00.000Z', isCorrect: true, responseTimeMs: 5000, changedAnswer: false },
      // Extra attempts on a long 26-question session to trigger fatigue calculation
      ...Array.from({ length: 26 }, (_, idx) => ({
        eventId: `long-${idx}`,
        sessionId: 'big-session',
        questionId: 'q3',
        questionNumber: 3,
        scope: 'specific' as const,
        answeredAt: `2026-11-20T10:${String(idx).padStart(2, '0')}:00.000Z`,
        isCorrect: idx < 13,
        responseTimeMs: idx >= 13 ? 2000 : 6000,
        changedAnswer: false,
      })),
    ];

    const telemetry = buildStatsAttemptTelemetry(bank, attempts);

    expect(telemetry.topicEvolution['common:tema 1'].deltaPp).toBe(100);
    expect(telemetry.topicEvolution['common:tema 1'].checkpoints.length).toBeGreaterThanOrEqual(2);
    expect(telemetry.errorRecovery.totalFailed).toBe(3);
    expect(telemetry.errorRecovery.recovered).toBe(1); // q1: 2 consecutive correct at end
    expect(telemetry.errorRecovery.recovering).toBe(1); // q2: 1 correct after 1 wrong
    expect(telemetry.errorRecovery.reincident).toBe(1); // q3: ended with false
    expect(telemetry.behavior.longSessionCount).toBe(1);
    expect(telemetry.behavior.longSessionFirstHalfAcc).toBe(100);
    expect(telemetry.behavior.longSessionSecondHalfAcc).toBe(0);
    expect(telemetry.behavior.longSessionDropPp).toBe(-100);
    expect(telemetry.behavior.avoidableErrorRate).not.toBeNull();
  });
});

describe('buildEvolutionChartData & mergeTopicInsights', () => {
  it('builds scoped daily evolution and period delta', () => {
    const referenceDate = new Date(2026, 10, 21, 12, 0, 0);
    const scopedDaily = {
      '2026-11-10': { common: { questions: 20, correct: 10 }, specific: { questions: 0, correct: 0 } },
      '2026-11-20': { common: { questions: 20, correct: 16 }, specific: { questions: 10, correct: 7 } },
    };
    const result = buildEvolutionChartData({
      sessions: [],
      scopedDaily,
      windowDays: 7,
      lens: 'common',
      locale: 'es',
      referenceDate,
    });

    expect(result.points).toHaveLength(7);
    expect(result.totalQuestions).toBe(20);
    expect(result.deltaPp).toBe(30);
  });

  it('merges topicBreakdown, risk and telemetry into syllabus summaries', () => {
    const telemetry = buildStatsAttemptTelemetry(
      [{ id: 'q1', number: 1, scope: 'specific', category: 'Tema 6' }],
      Array.from({ length: 6 }, (_, i) => ({
        eventId: `t6-${i}`,
        questionId: 'q1',
        questionNumber: 1,
        scope: 'specific' as const,
        answeredAt: `2026-11-${10 + i}T10:00:00.000Z`,
        isCorrect: i >= 3,
      })),
    );

    const insights = mergeTopicInsights({
      topicBreakdown: [
        {
          topicLabel: 'Tema 1',
          scope: 'common',
          attempts: 30,
          questionCount: 40,
          unseenCount: 10,
          fragileCount: 2,
          consolidatingCount: 8,
          solidCount: 10,
          masteredCount: 10,
          correctAttempts: 24,
          accuracyRate: 0.8,
        },
        {
          topicLabel: 'Tema 6',
          scope: 'specific',
          attempts: 20,
          questionCount: 50,
          unseenCount: 20,
          fragileCount: 12,
          consolidatingCount: 10,
          solidCount: 5,
          masteredCount: 3,
          correctAttempts: 11,
          accuracyRate: 0.55,
        },
      ],
      weakCategories: [
        {
          category: 'Tema 6',
          attempts: 20,
          incorrectAttempts: 9,
          rawFailRate: 0.45,
          smoothedFailRate: 0.43,
          baselineFailRate: 0.25,
          excessRisk: 0.18,
          sampleOk: true,
          confidenceFlag: 'high',
        },
      ],
      telemetry,
    });

    expect(insights).toHaveLength(2);
    expect(insights[1]).toMatchObject({ label: 'Tema 6', status: 'risk', excessRiskPct: 18 });

    const syllabi = buildSyllabusSummaries(insights, null);
    expect(syllabi).toHaveLength(2);
    expect(syllabi[0]).toMatchObject({ scope: 'common', coveragePct: 75, accuracyPct: 80 });
    expect(syllabi[1]).toMatchObject({ scope: 'specific', coveragePct: 60, riskTopicCount: 1 });
  });
});
