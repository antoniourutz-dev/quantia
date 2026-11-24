import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import StatsDashboard from './StatsDashboard';
import { LocaleProvider } from '../lib/locale';
import type { DashboardBundle } from '../lib/quantiaApi';
import type { TestResult } from '../types';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div style={{ width: 640, height: 260 }}>{children}</div>
    ),
  };
});

const buildBundle = (): DashboardBundle => ({
  identity: {
    user_id: 'u1',
    current_username: 'ana',
    is_admin: false,
    player_mode: 'advanced',
    previous_usernames: [],
  },
  practiceState: {
    recentSessions: [
      {
        id: 's1',
        mode: 'custom',
        title: 'Temas · Tema 1 · Constitución',
        startedAt: '2026-11-20T09:00:00.000Z',
        finishedAt: '2026-11-20T09:15:00.000Z',
        score: 17,
        total: 20,
      },
      {
        id: 's2',
        mode: 'custom',
        title: 'Desafío · Común + Específico',
        startedAt: '2026-11-21T09:00:00.000Z',
        finishedAt: '2026-11-21T09:30:00.000Z',
        score: 32,
        total: 50,
      },
      {
        id: 's3',
        mode: 'review',
        title: 'Corregir fallos',
        startedAt: '2026-11-21T11:00:00.000Z',
        finishedAt: '2026-11-21T11:10:00.000Z',
        score: 15,
        total: 20,
      },
    ],
    learningDashboard: null,
    learningDashboardV2: {
      totalQuestions: 200,
      seenQuestions: 130,
      coverageRate: 0.65,
      observedAccuracyRate: 0.71,
      observedAccuracyN: 90,
      observedAccuracyCiLow: 0.64,
      observedAccuracyCiHigh: 0.78,
      observedAccuracySampleOk: true,
      retentionSeenRate: 0.74,
      retentionSeenN: 50,
      retentionSeenConfidenceFlag: 'medium',
      unseenPriorRate: 0.25,
      examReadinessRate: 0.68,
      examReadinessCiLow: 0.62,
      examReadinessCiHigh: 0.74,
      examReadinessConfidenceFlag: 'medium',
      backlogOverdueCount: 12,
      fragileCount: 22,
      consolidatingCount: 34,
      solidCount: 44,
      masteredCount: 30,
      recommendedReviewCount: 12,
      recommendedNewCount: 8,
      recommendedTodayCount: 20,
      recommendedMode: 'standard',
      focusMessage: 'Refuerza los temas más flojos.',
      topicBreakdown: [
        {
          topicLabel: 'Tema 1 · Constitución',
          scope: 'common',
          attempts: 40,
          questionCount: 100,
          unseenCount: 20,
          fragileCount: 6,
          consolidatingCount: 18,
          solidCount: 30,
          masteredCount: 26,
          correctAttempts: 32,
          accuracyRate: 0.8,
        },
        {
          topicLabel: 'Tema 6 · Contratación',
          scope: 'specific',
          attempts: 50,
          questionCount: 100,
          unseenCount: 50,
          fragileCount: 16,
          consolidatingCount: 16,
          solidCount: 14,
          masteredCount: 4,
          correctAttempts: 28,
          accuracyRate: 0.56,
        },
      ],
    },
    examTarget: {
      userId: 'u1',
      curriculum: 'osakidetza_admin',
      examDate: '2026-12-30',
      dailyReviewCapacity: 30,
      dailyNewCapacity: 15,
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
    pressureInsights: null,
    pressureInsightsV2: {
      learningAccuracy: 0.71,
      simulacroAccuracy: null,
      pressureGapRaw: null,
      learningSessionN: 3,
      simulacroSessionN: 0,
      learningQuestionN: 90,
      simulacroQuestionN: 0,
      avgSimulacroFatigue: null,
      overconfidenceRate: null,
      sampleOk: false,
      confidenceFlag: 'low',
      recommendedMode: null,
      pressureMessage: '',
    },
  },
  activitySessions: [],
  questionsCount: 200,
  weakCategories: [
    {
      category: 'Tema 6 · Contratación',
      attempts: 50,
      incorrectAttempts: 22,
      rawFailRate: 0.44,
      smoothedFailRate: 0.42,
      baselineFailRate: 0.25,
      excessRisk: 0.17,
      sampleOk: true,
      confidenceFlag: 'high',
    },
  ],
  questionBlocks: [
    {
      scope: 'common',
      start: 1,
      end: 10,
      questionCount: 10,
      attemptedQuestionCount: 8,
      views: 12,
      attempts: 10,
      correct: 8,
      incorrect: 2,
      accuracyRate: 0.8,
      questions: [
        {
          id: 'q1',
          number: 1,
          text: 'Pregunta constitucional',
          views: 3,
          attempts: 2,
          correct: 2,
          incorrect: 0,
          accuracyRate: 1,
        },
      ],
    },
  ],
  statsTelemetry: {
    topicEvolution: {
      'common:tema 1 · constitución': {
        topicKey: 'tema 1 · constitución',
        scope: 'common',
        attempts: 40,
        correct: 32,
        recentAccuracy: 85,
        priorAccuracy: 75,
        deltaPp: 10,
        checkpoints: [70, 74, 78, 85],
      },
    },
    errorRecovery: {
      totalFailed: 20,
      recovered: 12,
      recovering: 5,
      reincident: 3,
    },
    scopedDaily: {
      '2026-11-20': { common: { questions: 20, correct: 17 }, specific: { questions: 0, correct: 0 } },
      '2026-11-21': { common: { questions: 20, correct: 14 }, specific: { questions: 50, correct: 38 } },
    },
    behavior: {
      longSessionCount: 1,
      longSessionFirstHalfAcc: 76,
      longSessionSecondHalfAcc: 64,
      longSessionDropPp: -12,
      timedSampleCount: 40,
      avoidableErrorRate: 22,
      fastErrorRate: 14,
      changedToWrongRate: 8,
    },
  },
});

const results: TestResult[] = [
  { id: 's1', date: '2026-11-20', score: 17, total: 20, mode: 'custom', label: 'Temas' },
  { id: 's2', date: '2026-11-21', score: 32, total: 50, mode: 'custom', label: 'Desafío' },
  { id: 's3', date: '2026-11-21', score: 15, total: 20, mode: 'review', label: 'Corregir fallos' },
];

describe('StatsDashboard', () => {
  it('mantiene el desglose por temas comprimido inicialmente y permite desplegar temarios y temas', async () => {
    const user = userEvent.setup();
    const onPracticeTopic = vi.fn();

    render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={buildBundle()}
          curriculum="osakidetza_admin"
          onPracticeTopic={onPracticeTopic}
        />
      </LocaleProvider>,
    );

    // Pulso general y transferencia sin simulacros visibles desde el primer vistazo
    expect(screen.getAllByText('68%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/62% – 74%/)).toBeInTheDocument();
    expect(screen.getByText(/En foco \(1 tema\) vs\. Mezclado \/ Largo/i)).toBeInTheDocument();
    expect(screen.getByText(/Temas \(en foco\)/i)).toBeInTheDocument();
    expect(screen.getByText('Desafío')).toBeInTheDocument();
    expect(screen.getByText(/60% recuperadas/i)).toBeInTheDocument();

    // Temas individuales están comprimidos inicialmente en Bloque 3 para no generar scroll largo
    const topicsBreakdown = screen.getByTestId('topics-breakdown-section');
    expect(within(topicsBreakdown).queryByText('Tema 1 · Constitución')).not.toBeInTheDocument();
    expect(within(topicsBreakdown).queryByText('Tema 6 · Contratación')).not.toBeInTheDocument();
    expect(screen.queryByText('Pregunta constitucional')).not.toBeInTheDocument();

    // Desplegar el acordeón del Temario Común
    const expandCommonBtn = screen.getByRole('button', { name: /Temario Comun.*Ver temas/i });
    expect(expandCommonBtn).toHaveAttribute('aria-expanded', 'false');
    await user.click(expandCommonBtn);
    expect(expandCommonBtn).toHaveAttribute('aria-expanded', 'true');

    // Ahora aparece la fila del tema (con su detalle aún comprimido)
    const topicRowBtn = screen.getByRole('button', { name: /Tema 1 · Constitución/i });
    expect(topicRowBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Practicar tema/i })).not.toBeInTheDocument();

    // Al pulsar el tema se despliega el detalle y el CTA de práctica
    await user.click(topicRowBtn);
    expect(topicRowBtn).toHaveAttribute('aria-expanded', 'true');
    const practiceBtn = screen.getByRole('button', { name: /Practicar tema/i });
    await user.click(practiceBtn);
    expect(onPracticeTopic).toHaveBeenCalledWith('Tema 1 · Constitución', 'common');
  });

  it('permite abrir el mosaico de bloques y lanzar un repaso de bloque', async () => {
    const user = userEvent.setup();
    const onPracticeBlock = vi.fn();

    render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={buildBundle()}
          curriculum="osakidetza_admin"
          onPracticeBlock={onPracticeBlock}
        />
      </LocaleProvider>,
    );

    const blocksHeaderBtn = screen.getByRole('button', { name: /Mosaico de bloques de 10/i });
    expect(blocksHeaderBtn).toHaveAttribute('aria-expanded', 'false');
    await user.click(blocksHeaderBtn);
    expect(blocksHeaderBtn).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByText('Pregunta constitucional')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Repasar bloque/i }));
    expect(onPracticeBlock).toHaveBeenCalledWith(1, 10, 'common');
  });

  it('soporta localización en euskera', () => {
    render(
      <LocaleProvider locale="eu">
        <StatsDashboard
          results={results}
          bundle={buildBundle()}
          curriculum="goi-teknikaria"
        />
      </LocaleProvider>,
    );

    expect(screen.getByText(/Egoera orokorra/i)).toBeInTheDocument();
    expect(screen.getByText(/Zure gaien mapa osoa/i)).toBeInTheDocument();
  });

  it('usa el estado real de aciertos cuando learningV2 devuelve todo en frágiles', () => {
    const skewedBundle = buildBundle();
    skewedBundle.practiceState.learningDashboardV2!.fragileCount = 130;
    skewedBundle.practiceState.learningDashboardV2!.masteredCount = 0;
    skewedBundle.practiceState.learningDashboardV2!.solidCount = 0;
    skewedBundle.practiceState.learningDashboardV2!.consolidatingCount = 0;
    skewedBundle.statsTelemetry!.memorySummary = {
      mastered: 75,
      solid: 35,
      consolidating: 15,
      fragile: 5,
      unseen: 70,
      totalQuestions: 200,
    };

    render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={skewedBundle}
          curriculum="osakidetza_mantenimiento_instalaciones"
        />
      </LocaleProvider>,
    );

    expect(screen.getByText(/Dominadas \+ Sólidas: 110/i)).toBeInTheDocument();
    expect(screen.getByTitle('Dominadas: 75')).toBeInTheDocument();
    expect(screen.getByTitle('Frágiles: 5')).toBeInTheDocument();
  });

  it('muestra estado de carga mientras hidrata telemetria y boton de reintentar ante error', async () => {
    const user = userEvent.setup();
    const onRetryTelemetry = vi.fn();
    const primaryOnlyBundle = buildBundle();
    primaryOnlyBundle.statsTelemetry = null;

    const { rerender } = render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={primaryOnlyBundle}
          curriculum="osakidetza_admin"
          hydrating
          telemetryError={null}
          onRetryTelemetry={onRetryTelemetry}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/Actualizando memoria del banco/i);

    rerender(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={primaryOnlyBundle}
          curriculum="osakidetza_admin"
          hydrating={false}
          telemetryError="Timeout"
          onRetryTelemetry={onRetryTelemetry}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo cargar toda la telemetría/i);
    await user.click(screen.getByRole('button', { name: /Reintentar/i }));
    expect(onRetryTelemetry).toHaveBeenCalledTimes(1);
  });

  it('muestra onboarding guiado cuando el alumno no tiene actividad previa', async () => {
    const user = userEvent.setup();
    const onStartRecommended = vi.fn();

    render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={[]}
          bundle={null}
          curriculum="osakidetza_admin"
          onStartRecommended={onStartRecommended}
        />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole('heading', { name: /Completa tu primer test para activar tus estadísticas/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Empezar mi primer test/i }));
    expect(onStartRecommended).toHaveBeenCalledTimes(1);
  });

  it('soporta pestañas ARIA, selector de teclado en Matriz, CTA de 1 clic en Leyes/Fallos/Mezclado y filtros accesibles', async () => {
    const user = userEvent.setup();
    const onPracticeLaw = vi.fn();
    const onPracticeReviewMistakes = vi.fn();
    const onPracticeMixed = vi.fn();

    const richBundle = buildBundle();
    richBundle.practiceState.learningDashboardV2!.lawBreakdown = [
      {
        lawId: 'law-39',
        ley_referencia: 'Ley 39/2015',
        shortTitle: 'Ley 39/2015 LPACAP',
        attempts: 25,
        questionCount: 40,
        consolidatedCount: 22,
        accuracyRate: 0.72,
        blocks: [{ blockId: 'b1', title: 'Título I', attempts: 10, accuracyRate: 0.8 }],
      },
    ];

    render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={richBundle}
          curriculum="osakidetza_admin"
          onPracticeLaw={onPracticeLaw}
          onPracticeReviewMistakes={onPracticeReviewMistakes}
          onPracticeMixed={onPracticeMixed}
        />
      </LocaleProvider>,
    );

    // Grupos de filtros desambiguados y barras con role="progressbar"
    expect(screen.getByRole('group', { name: /Filtrar temas por temario/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Filtrar temas por estado/i })).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThanOrEqual(4);

    // 1-click CTAs en Transferencia (gap -21 pts) y Recuperación de fallos (3 reincidentes)
    await user.click(screen.getByRole('button', { name: /Hacer test mezclado/i }));
    expect(onPracticeMixed).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Repasar fallos/i }));
    expect(onPracticeReviewMistakes).toHaveBeenCalledTimes(1);

    // Pestaña Matriz + selector accesible por teclado
    await user.click(screen.getByRole('tab', { name: /Matriz/i }));
    const matrixSelect = screen.getByLabelText(/Seleccionar tema en la matriz/i);
    expect(matrixSelect).toBeInTheDocument();

    // Pestaña Por leyes oculta filtros muertos de ámbito/estado y ofrece CTA de 1 clic
    await user.click(screen.getByRole('tab', { name: /Por leyes/i }));
    expect(screen.queryByRole('group', { name: /Filtrar temas por estado/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Practicar ley/i }));
    expect(onPracticeLaw).toHaveBeenCalledWith('Ley 39/2015');
  });

  it('permite simular nota neta con 0 / -0,25 / -0,33 y lanzar práctica 1-clic desde Priorizador ROI', async () => {
    const user = userEvent.setup();
    const onChangePenaltyRule = vi.fn();
    const onPracticeTopic = vi.fn();

    render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={buildBundle()}
          curriculum="osakidetza_admin"
          penaltyRule="none"
          onChangePenaltyRule={onChangePenaltyRule}
          onPracticeTopic={onPracticeTopic}
        />
      </LocaleProvider>,
    );

    const simulator = screen.getByRole('region', {
      name: /Simulador de nota neta y priorizador ROI/i,
    });
    expect(within(simulator).getByText('6,80')).toBeInTheDocument();

    // Cambiar regla a -0,25: 68 - 32 * 0.25 = 60 -> 6,00 / 10
    const ruleGroup = within(simulator).getByRole('radiogroup', {
      name: /Regla de penalización del simulador/i,
    });
    await user.click(within(ruleGroup).getByRole('radio', { name: '-0,25' }));
    expect(onChangePenaltyRule).toHaveBeenCalledWith('quarter');
    expect(within(simulator).getByText('6,00')).toBeInTheDocument();

    // Cambiar regla a -0,33: 68 - 32 / 3 = 57.333... -> 5,73 / 10
    await user.click(within(ruleGroup).getByRole('radio', { name: '-0,33' }));
    expect(onChangePenaltyRule).toHaveBeenCalledWith('third');
    expect(within(simulator).getByText('5,73')).toBeInTheDocument();

    // Ajustar longitud de examen a 50 preguntas y % respondidas a 80%
    await user.click(within(simulator).getByRole('button', { name: '50' }));
    const answerRateSlider = within(simulator).getByLabelText(/Estrategia \(% respondidas\)/i);
    fireEvent.change(answerRateSlider, { target: { value: '80' } });
    // 50 * 0.8 = 40 answered -> 10 blanks
    expect(within(simulator).getByText('10')).toBeInTheDocument();

    // Priorizador ROI lista primero el tema de mayor retorno (Tema 6 · Contratación) y permite 1 clic
    const roiButtons = within(simulator).getAllByRole('button', { name: 'Practicar' });
    expect(roiButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(roiButtons[0]);
    expect(onPracticeTopic).toHaveBeenCalledWith('Tema 6 · Contratación', 'specific');
  });

  it('usa fallback de lawBreakdown en el Priorizador ROI cuando no hay topicBreakdown', async () => {
    const user = userEvent.setup();
    const onPracticeLaw = vi.fn();
    const lawOnlyBundle = buildBundle();
    lawOnlyBundle.practiceState.learningDashboardV2!.topicBreakdown = [];
    lawOnlyBundle.practiceState.learningDashboardV2!.lawBreakdown = [
      {
        lawId: 'law-39',
        ley_referencia: 'Ley 39/2015',
        shortTitle: 'Ley 39/2015 LPACAP',
        attempts: 25,
        questionCount: 40,
        consolidatedCount: 10,
        correctAttempts: 14,
        accuracyRate: 0.56,
      },
    ];

    render(
      <LocaleProvider locale="es">
        <StatsDashboard
          results={results}
          bundle={lawOnlyBundle}
          curriculum="leyes-generales"
          penaltyRule="quarter"
          onPracticeLaw={onPracticeLaw}
        />
      </LocaleProvider>,
    );

    const simulator = screen.getByRole('region', {
      name: /Simulador de nota neta y priorizador ROI/i,
    });
    expect(within(simulator).getByText('Ley 39/2015')).toBeInTheDocument();
    await user.click(within(simulator).getByRole('button', { name: 'Practicar' }));
    expect(onPracticeLaw).toHaveBeenCalledWith('Ley 39/2015');
  });
});

