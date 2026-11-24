import { createElement, type ReactElement, type ReactNode } from 'react';
import { fireEvent, render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import { LocaleProvider, type AppLocale } from '../../../src/lib/locale';
import type {
  FinishedTestPayload,
  PracticeExamTarget,
  PracticeLearningDashboardV2,
  PracticeSessionSummary,
  PracticeTopicPerformance,
  Question,
  TestAnswer,
  TestResult,
} from '../../../src/types';
import type { CurriculumOption, DashboardBundle } from '../../../src/lib/quantia/types';
import type { CoachPlanV2 } from '../../../src/lib/coach';
import type { StudyQuestionData } from '../../../src/lib/quantiaApi';
import type { TopicInsightItem } from '../../../src/lib/statsInsights';

export function resetE2EEnvironment(): void {
  window.localStorage.clear();
  window.scrollTo = vi.fn();
}

export function renderWithLocale(
  ui: ReactElement,
  locale: AppLocale = 'es',
): RenderResult {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(LocaleProvider, { locale, children });
  return render(ui, { wrapper: Wrapper });
}

export function simulateTextSelection(
  element: Element,
  startOffset: number,
  endOffset: number,
): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode();
  if (!textNode) {
    throw new Error('simulateTextSelection: no text node found inside target element');
  }

  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    anchorNode: textNode,
    focusNode: textNode,
    anchorOffset: startOffset,
    focusOffset: endOffset,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        top: 120,
        left: 120,
        width: 80,
        height: 20,
      }),
    }),
    removeAllRanges: vi.fn(),
  } as unknown as Selection);

  fireEvent(document, new Event('selectionchange'));
}

export function buildSampleQuestions(count = 4): Question[] {
  const base: Question[] = [
    {
      id: 'q-h2-1',
      number: 1,
      text: 'Según la Ley 39/2015, el plazo para interponer recurso de alzada contra acto expreso es de un mes.',
      options: [
        { id: 'a', text: 'Un mes desde el día siguiente a la notificación.' },
        { id: 'b', text: 'Quince días hábiles desde la publicación.' },
        { id: 'c', text: 'Dos meses en cualquier caso.' },
        { id: 'd', text: 'Diez días naturales.' },
      ],
      correctAnswer: 'a',
      explanation: 'El artículo 122.1 de la Ley 39/2015 establece un plazo de un mes si el acto fuera expreso.',
      syllabus: 'common',
      category: 'Ley 39/2015 · Procedimiento Administrativo',
      questionScope: 'common',
    },
    {
      id: 'q-h2-2',
      number: 2,
      text: 'En el Estatuto Marco del personal estatutario, las faltas muy graves prescriben a los cuatro años.',
      options: [
        { id: 'a', text: 'A los dos años.' },
        { id: 'b', text: 'A los cuatro años.' },
        { id: 'c', text: 'Al año.' },
        { id: 'd', text: 'A los seis meses.' },
      ],
      correctAnswer: 'b',
      explanation: 'Artículo 72.5 de la Ley 55/2003 del Estatuto Marco: las faltas muy graves prescriben a los cuatro años.',
      syllabus: 'specific',
      category: 'Ley 55/2003 · Estatuto Marco',
      questionScope: 'specific',
    },
    {
      id: 'q-h2-3',
      number: 3,
      text: 'La Constitución Española de 1978 reconoce el derecho a la protección de la salud en su artículo 43.',
      options: [
        { id: 'a', text: 'Artículo 14.' },
        { id: 'b', text: 'Artículo 27.' },
        { id: 'c', text: 'Artículo 43.' },
        { id: 'd', text: 'Artículo 53.' },
      ],
      correctAnswer: 'c',
      explanation: 'El artículo 43.1 de la Constitución Española reconoce el derecho a la protección de la salud.',
      syllabus: 'common',
      category: 'Constitución Española',
      questionScope: 'common',
    },
    {
      id: 'q-h2-4',
      number: 4,
      text: 'La Ley 41/2002 regula la autonomía del paciente y la documentación clínica en el ámbito sanitario.',
      options: [
        { id: 'a', text: 'Ley 14/1986.' },
        { id: 'b', text: 'Ley 41/2002.' },
        { id: 'c', text: 'Ley 16/2003.' },
        { id: 'd', text: 'Ley 44/2003.' },
      ],
      correctAnswer: 'b',
      explanation: 'La Ley 41/2002, de 14 de noviembre, es la ley básica reguladora de la autonomía del paciente.',
      syllabus: 'specific',
      category: 'Ley 41/2002 · Autonomía del Paciente',
      questionScope: 'specific',
    },
  ];

  if (count <= base.length) {
    return base.slice(0, count);
  }

  const extended: Question[] = [...base];
  for (let i = base.length; i < count; i += 1) {
    const idx = i + 1;
    extended.push({
      id: `q-h2-${idx}`,
      number: idx,
      text: `Pregunta normativa de muestra número ${idx} sobre procedimiento administrativo.`,
      options: [
        { id: 'a', text: `Opción A de pregunta ${idx}` },
        { id: 'b', text: `Opción B de pregunta ${idx}` },
        { id: 'c', text: `Opción C de pregunta ${idx}` },
        { id: 'd', text: `Opción D de pregunta ${idx}` },
      ],
      correctAnswer: 'a',
      explanation: `Explicación oficial de la pregunta ${idx} según la normativa vigente.`,
      syllabus: idx % 2 === 0 ? 'specific' : 'common',
      category: idx % 2 === 0 ? 'Ley 55/2003 · Estatuto Marco' : 'Ley 39/2015 · Procedimiento Administrativo',
      questionScope: idx % 2 === 0 ? 'specific' : 'common',
    });
  }
  return extended;
}

export function buildFinishedTestPayload(
  questions: Question[],
  pattern: Array<'correct' | 'incorrect' | 'blank'>,
  flaggedQuestionIds: string[] = [],
): FinishedTestPayload {
  let score = 0;
  const answers: TestAnswer[] = questions.map((question, idx) => {
    const outcome = pattern[idx] ?? 'correct';
    const correctOption = question.correctAnswer ?? 'a';
    if (outcome === 'blank') {
      return {
        questionId: question.id,
        selectedOption: null,
        correctOption,
        isCorrect: false,
        answeredAt: '2026-11-23T09:00:00.000Z',
        responseTimeMs: 4200,
        timeToFirstSelectionMs: null,
        changedAnswer: false,
      };
    }

    const isCorrect = outcome === 'correct';
    if (isCorrect) score += 1;
    const wrongOption = correctOption === 'a' ? 'b' : 'a';

    return {
      questionId: question.id,
      selectedOption: isCorrect ? correctOption : wrongOption,
      correctOption,
      isCorrect,
      answeredAt: '2026-11-23T09:00:00.000Z',
      responseTimeMs: 6500,
      timeToFirstSelectionMs: 5100,
      changedAnswer: false,
    };
  });

  return {
    score,
    answers,
    flaggedQuestionIds,
  };
}

export function buildSampleExamTarget(overrides?: Partial<PracticeExamTarget>): PracticeExamTarget {
  return {
    userId: 'user-h2-1',
    curriculum: 'osakidetza-celador',
    examDate: '2027-06-15',
    dailyReviewCapacity: 30,
    dailyNewCapacity: 15,
    updatedAt: '2026-11-22T10:00:00.000Z',
    ...overrides,
  };
}

export function buildSampleCurriculumOptions(): CurriculumOption[] {
  return [
    { id: 'osakidetza-celador', label: 'Osakidetza · Celador', questionCount: 420 },
    { id: 'goi-teknikaria-2026', label: 'Goi-Teknikaria 2026', questionCount: 310 },
  ];
}

export function buildSampleTopicBreakdown(): PracticeTopicPerformance[] {
  return [
    {
      topicLabel: 'Tema 1 · Constitución',
      scope: 'common',
      attempts: 50,
      questionCount: 100,
      unseenCount: 15,
      fragileCount: 12,
      consolidatingCount: 23,
      solidCount: 30,
      masteredCount: 20,
      correctAttempts: 30,
      accuracyRate: 0.6,
    },
    {
      topicLabel: 'Tema 2 · Ley 39/2015',
      scope: 'common',
      attempts: 40,
      questionCount: 120,
      unseenCount: 55,
      fragileCount: 18,
      consolidatingCount: 17,
      solidCount: 20,
      masteredCount: 10,
      correctAttempts: 20,
      accuracyRate: 0.5,
    },
    {
      topicLabel: 'Tema 3 · Estatuto Marco',
      scope: 'specific',
      attempts: 35,
      questionCount: 90,
      unseenCount: 30,
      fragileCount: 14,
      consolidatingCount: 16,
      solidCount: 18,
      masteredCount: 12,
      correctAttempts: 21,
      accuracyRate: 0.6,
    },
    {
      topicLabel: 'Tema 4 · Autonomía del Paciente',
      scope: 'specific',
      attempts: 25,
      questionCount: 80,
      unseenCount: 40,
      fragileCount: 10,
      consolidatingCount: 10,
      solidCount: 12,
      masteredCount: 8,
      correctAttempts: 18,
      accuracyRate: 0.72,
    },
    {
      topicLabel: 'Tema 5 · Igualdad',
      scope: 'common',
      attempts: 20,
      questionCount: 60,
      unseenCount: 25,
      fragileCount: 6,
      consolidatingCount: 9,
      solidCount: 12,
      masteredCount: 8,
      correctAttempts: 16,
      accuracyRate: 0.8,
    },
    {
      topicLabel: 'Tema 6 · Prevención Riesgos',
      scope: 'specific',
      attempts: 30,
      questionCount: 50,
      unseenCount: 5,
      fragileCount: 2,
      consolidatingCount: 8,
      solidCount: 15,
      masteredCount: 20,
      correctAttempts: 27,
      accuracyRate: 0.9,
    },
  ];
}

export function buildSampleTopicInsightItems(): TopicInsightItem[] {
  return buildSampleTopicBreakdown().map((topic, index) => {
    const questionCount = topic.questionCount ?? 60;
    const unseenCount = topic.unseenCount ?? 10;
    const seenCount = Math.max(0, questionCount - unseenCount);
    const coveragePct = questionCount > 0 ? Math.round((seenCount / questionCount) * 100) : 0;
    const accuracyPct = Math.round(topic.accuracyRate * 100);
    return {
      id: `topic-${index + 1}`,
      label: topic.topicLabel,
      scope: topic.scope === 'specific' ? 'specific' : 'common',
      questionCount,
      seenCount,
      unseenCount,
      coveragePct,
      attempts: topic.attempts,
      accuracyPct,
      deltaPp: null,
      checkpoints: [Math.max(0, accuracyPct - 5), accuracyPct],
      fragileCount: topic.fragileCount ?? 5,
      consolidatingCount: topic.consolidatingCount ?? 10,
      solidCount: topic.solidCount ?? 15,
      masteredCount: topic.masteredCount ?? 10,
      excessRiskPct: accuracyPct < 65 ? 65 - accuracyPct : null,
      status: accuracyPct < 65 ? 'risk' : 'improving',
    };
  });
}

export function buildSampleDashboardBundle(overrides?: Partial<DashboardBundle>): DashboardBundle {
  const recentSessions: PracticeSessionSummary[] = [
    {
      id: 'sess-1',
      mode: 'standard',
      title: 'Test por temario · Común',
      startedAt: '2026-11-21T09:00:00.000Z',
      finishedAt: '2026-11-21T09:15:00.000Z',
      score: 16,
      total: 20,
    },
    {
      id: 'sess-2',
      mode: 'review',
      title: 'Corregir fallos',
      startedAt: '2026-11-22T09:00:00.000Z',
      finishedAt: '2026-11-22T09:12:00.000Z',
      score: 14,
      total: 20,
    },
  ];

  const learningDashboardV2: PracticeLearningDashboardV2 = {
    totalQuestions: 500,
    seenQuestions: 260,
    coverageRate: 0.52,
    observedAccuracyRate: 0.68,
    observedAccuracyN: 140,
    observedAccuracyCiLow: 0.61,
    observedAccuracyCiHigh: 0.75,
    observedAccuracySampleOk: true,
    retentionSeenRate: 0.72,
    retentionSeenN: 80,
    retentionSeenConfidenceFlag: 'medium',
    unseenPriorRate: 0.25,
    examReadinessRate: 0.64,
    examReadinessCiLow: 0.58,
    examReadinessCiHigh: 0.7,
    examReadinessConfidenceFlag: 'medium',
    backlogOverdueCount: 14,
    fragileCount: 38,
    consolidatingCount: 64,
    solidCount: 92,
    masteredCount: 66,
    recommendedReviewCount: 14,
    recommendedNewCount: 6,
    recommendedTodayCount: 20,
    recommendedMode: 'review',
    focusMessage: 'Refuerza Ley 39/2015 antes de avanzar.',
    topicBreakdown: buildSampleTopicBreakdown(),
  };

  return {
    identity: {
      user_id: 'user-h2-1',
      current_username: 'opositor_h2',
      is_admin: false,
      player_mode: 'advanced',
      previous_usernames: [],
      streak: 5,
    },
    practiceState: {
      recentSessions,
      learningDashboard: null,
      learningDashboardV2,
      examTarget: buildSampleExamTarget(),
      pressureInsights: null,
      pressureInsightsV2: null,
    },
    activitySessions: recentSessions,
    questionsCount: 500,
    weakCategories: [],
    questionBlocks: [],
    statsTelemetry: null,
    hydrationStatus: 'ready',
    telemetryError: null,
    ...overrides,
  };
}

export function buildSampleTestResults(): TestResult[] {
  return [
    {
      id: 'res-1',
      date: '2026-11-21T09:15:00.000Z',
      score: 16,
      total: 20,
      mode: 'standard',
      label: 'Bloque común',
    },
    {
      id: 'res-2',
      date: '2026-11-22T09:12:00.000Z',
      score: 14,
      total: 20,
      mode: 'review',
      label: 'Corregir fallos',
    },
  ];
}

export function buildSampleCoachPlan(): CoachPlanV2 {
  return {
    primaryAction: 'review',
    intensity: 'medium',
    duration: 'normal',
    tone: 'protect',
    urgency: 'medium',
    confidence: 0.82,
    reasons: ['Tienes 14 preguntas vencidas para repaso.'],
    evidence: {
      dominantProblem: 'backlog_overdue',
      supportingSignals: ['14 preguntas pendientes'],
    },
    sessionSpec: {
      targetQuestions: 15,
      targetMinutes: 12,
      allowedDifficulty: 'mixed',
      focusScope: 'weak_only',
    },
  };
}

export function buildSampleStudyData(): StudyQuestionData {
  return {
    highlights: {
      'q-h2-1': [
        {
          id: 'hl-q1-stem',
          startIndex: 0,
          endIndex: 20,
          type: 'law_reference',
        },
      ],
      'q-h2-1_exp': [
        {
          id: 'hl-q1-exp',
          startIndex: 3,
          endIndex: 17,
          type: 'deadline',
        },
      ],
    },
    notes: {
      'q-h2-1': 'Recordar: acto expreso = 1 mes; silencio administrativo = cualquier momento.',
      'q-h2-2': 'Faltas muy graves prescriben a los 4 años en Estatuto Marco.',
    },
  };
}
