import { describe, expect, it } from 'vitest';
import {
  buildCoachPlanV2,
  buildCoachTwoLineMessageV2,
  buildExecutableSessionPlanFromCoach,
} from './coach';

const referenceDate = new Date('2026-11-23T12:00:00.000Z');

describe('coach.ts (bilingual ES/EU + sessionSpec)', () => {
  it('usa tildes correctas en español en reasons, evidence y two-line messages', () => {
    const plan = buildCoachPlanV2(
      {
        learningDashboard: {
          readiness: 0.4,
          overdueCount: 0,
          dailyReviewCapacity: 35,
          dailyNewCapacity: 10,
          examDate: null,
        } as never,
        learningDashboardV2: null,
        pressureInsights: {
          pressureGap: 0.2,
          avgSimulacroFatigue: 0.8,
        } as never,
        pressureInsightsV2: null,
        examTarget: null,
        recentSessions: [
          {
            id: 's1',
            startedAt: '2026-11-18T10:00:00.000Z',
            finishedAt: '2026-11-18T10:20:00.000Z',
            score: 4,
            total: 10,
            mode: 'standard',
          },
        ],
        recommendedBatchNumber: 1,
        totalBatches: 5,
        batchSize: 20,
        locale: 'es',
      },
      referenceDate,
    );

    expect(plan.primaryAction).toBe('recovery');
    expect(plan.evidence.dominantProblem).toBe('Pérdida de ritmo');
    expect(plan.evidence.supportingSignals).toContain('Última sesión hace 5d');
    expect(plan.evidence.supportingSignals).toContain('Brecha de presión 20 pts');
    expect(plan.reasons.some((reason) => reason.includes('días sin sesión'))).toBe(true);
    expect(plan.reasons.some((reason) => reason.includes('todavía'))).toBe(true);

    const msg = buildCoachTwoLineMessageV2(plan, 'es');
    expect(msg.line2).toContain('sesión');
    expect(msg.line2).toContain('dinámica');
  });

  it('traduce reasons, evidence y buildCoachTwoLineMessageV2 al euskera (eu)', () => {
    const plan = buildCoachPlanV2(
      {
        learningDashboard: {
          readiness: 0.4,
          overdueCount: 20,
          dailyReviewCapacity: 35,
          dailyNewCapacity: 10,
          examDate: null,
        } as never,
        learningDashboardV2: {
          backlogOverdueCount: 45,
        } as never,
        pressureInsights: null,
        pressureInsightsV2: null,
        examTarget: null,
        recentSessions: [
          {
            id: 's2',
            startedAt: '2026-11-22T10:00:00.000Z',
            finishedAt: '2026-11-22T10:20:00.000Z',
            score: 5,
            total: 10,
            mode: 'standard',
          },
        ],
        recommendedBatchNumber: 1,
        totalBatches: 5,
        batchSize: 20,
        locale: 'eu',
      },
      referenceDate,
    );

    expect(plan.primaryAction).toBe('review');
    expect(plan.evidence.dominantProblem).toBe('Oinarrian zorra');
    expect(plan.evidence.supportingSignals).toContain('Premiazko errepasoak 45');
    expect(plan.evidence.supportingSignals).toContain('Azken asmatzea 50%');
    expect(plan.reasons.some((reason) => reason.includes('Pilatutako errepaso'))).toBe(true);

    const msg = buildCoachTwoLineMessageV2(plan, 'eu');
    expect(msg.line1).toBe('Errepaso errentagarria duzu aurrean.');
    expect(msg.line2).toBe('Gaur hobe da aurrera egin aurretik sendotzea.');
  });

  it('mapea correctamente sessionSpec y primaryAction a ExecutableSessionPlan', () => {
    const recoveryPlan = buildCoachPlanV2(
      {
        learningDashboard: null,
        learningDashboardV2: null,
        pressureInsights: { pressureGap: 0.1, avgSimulacroFatigue: 0.85 } as never,
        pressureInsightsV2: null,
        examTarget: null,
        recentSessions: [
          {
            id: 's3',
            startedAt: '2026-11-17T10:00:00.000Z',
            finishedAt: '2026-11-17T10:15:00.000Z',
            score: 6,
            total: 10,
            mode: 'standard',
          },
        ],
        recommendedBatchNumber: 1,
        totalBatches: 5,
        batchSize: 20,
      },
      referenceDate,
    );

    expect(recoveryPlan.primaryAction).toBe('recovery');
    expect(recoveryPlan.sessionSpec.targetQuestions).toBe(10);
    expect(recoveryPlan.sessionSpec.targetMinutes).toBe(12);

    const executable = buildExecutableSessionPlanFromCoach(recoveryPlan, {
      defaultQuestionCount: 20,
      syllabus: null,
      dominantState: 'recovery_needed',
    });

    expect(executable.source).toBe('coach');
    expect(executable.primaryAction).toBe('recovery');
    expect(executable.mode).toBe('standard');
    expect(executable.questionCount).toBe(10);
    expect(executable.dominantState).toBe('recovery_needed');
  });

  it('cubre mensajes de dos líneas en ES y EU para todas las acciones principales', () => {
    const actions = ['review', 'recovery', 'simulacro', 'anti_trap', 'push', 'standard'] as const;
    for (const primaryAction of actions) {
      const dummyPlan = {
        primaryAction,
        intensity: 'medium',
        duration: 'normal',
        tone: 'maintain',
        urgency: 'low',
        confidence: 0.8,
        reasons: [],
        evidence: { dominantProblem: '', supportingSignals: [] },
        sessionSpec: {},
      } as const;

      const es = buildCoachTwoLineMessageV2(dummyPlan, 'es');
      const eu = buildCoachTwoLineMessageV2(dummyPlan, 'eu');
      expect(es.text).toBe(`${es.line1} ${es.line2}`);
      expect(eu.text).toBe(`${eu.line1} ${eu.line2}`);
      expect(eu.line1).not.toBe(es.line1);
    }
  });
});
