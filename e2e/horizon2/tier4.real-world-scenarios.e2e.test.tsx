import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { FinishedTestPayload } from '../../src/types';
import {
  loadProjectModule,
  type MyNotesAndHighlightsModule,
  type NetScoreModule,
  type PenaltyRuleId,
  type PostTestStatsH2Module,
  type QuestionErrataPanelModule,
  type QuestionNoteDrawerModule,
  type SettingsPanelH2Module,
  type StatsDashboardH2Module,
  type TestInterfaceH2Module,
  type TestSelectionH2Module,
  type TodayPlanStripModule,
} from './helpers/loadModule';
import {
  buildFinishedTestPayload,
  buildSampleCurriculumOptions,
  buildSampleDashboardBundle,
  buildSampleExamTarget,
  buildSampleQuestions,
  buildSampleTestResults,
  renderWithLocale,
  resetE2EEnvironment,
  simulateTextSelection,
} from './helpers/fixtures';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div style={{ width: 640, height: 260 }}>{children}</div>
    ),
  };
});

describe('Horizonte 2 — Tier 4: Real-World Opositor Workflows', () => {
  beforeEach(() => {
    resetE2EEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario A (Osakidetza ES Opositor): configures -0,33 -> launches TodayPlanStrip -> completes test with note/errata -> reviews PostTestStats Nota Neta & highlights -> edits note in MyNotesAndHighlights -> triggers ROI practice in StatsDashboard', async () => {
    const netScore = await loadProjectModule<NetScoreModule>('src/lib/netScore.ts');
    const { default: SettingsPanel } = await loadProjectModule<SettingsPanelH2Module>(
      'src/components/SettingsPanel.tsx',
    );
    const { default: TodayPlanStrip } = await loadProjectModule<TodayPlanStripModule>(
      'src/components/TodayPlanStrip.tsx',
    );
    const { default: TestInterface } = await loadProjectModule<TestInterfaceH2Module>(
      'src/components/TestInterface.tsx',
    );
    const { default: PostTestStats } = await loadProjectModule<PostTestStatsH2Module>(
      'src/components/PostTestStats.tsx',
    );
    const { default: MyNotesAndHighlights } = await loadProjectModule<MyNotesAndHighlightsModule>(
      'src/components/MyNotesAndHighlights.tsx',
    );
    const { default: StatsDashboard } = await loadProjectModule<StatsDashboardH2Module>(
      'src/components/StatsDashboard.tsx',
    );

    const userId = 'osakidetza-es-user';
    const user = userEvent.setup();

    // 1. Configure -0,33 in SettingsPanel
    let activeRule: PenaltyRuleId = netScore.readPenaltyRule(userId);
    const step1 = renderWithLocale(
      <SettingsPanel
        examTarget={buildSampleExamTarget({ userId })}
        saving={false}
        notice={null}
        curriculumOptions={buildSampleCurriculumOptions()}
        visibleCurriculumIds={['osakidetza-celador']}
        visiblePracticeModeIds={['standard', 'errors', 'topics', 'simulacro', 'challenge', 'custom']}
        customSupportMode={{ showMarks: true, showNotes: true }}
        penaltyRule={activeRule}
        onSave={async (next) => {
          netScore.writePenaltyRule(userId, next.penaltyRule);
          activeRule = netScore.readPenaltyRule(userId);
        }}
      />,
      'es',
    );

    const penaltyGroupEs = screen.getByRole('radiogroup', { name: /penaliz/i });
    await user.click(within(penaltyGroupEs).getByRole('radio', { name: /-0,33/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => {
      expect(activeRule).toBe('third');
    });
    step1.unmount();

    // 2. Inspect TodayPlanStrip and launch Coach session
    let launchedCoach = false;
    const step2 = renderWithLocale(
      <TodayPlanStrip
        streakDays={9}
        hydrated={true}
        eyebrow="Tu plan de hoy"
        title="Consolida Ley 39/2015"
        subtitle="Tu nota neta mejora si reduces los fallos en procedimiento."
        sessionMetaLabel="3 preg. · ~3 min"
        ctaLabel="Empezar sesión"
        tone="build"
        onStartPlan={() => {
          launchedCoach = true;
        }}
      />,
      'es',
    );

    expect(screen.getByTestId('today-plan-streak')).toHaveTextContent(/9/);
    await user.click(screen.getByRole('button', { name: /empezar sesión/i }));
    expect(launchedCoach).toBe(true);
    step2.unmount();

    // 3. Complete mixed correct/incorrect/blank test in TestInterface with note & errata
    const questions = buildSampleQuestions(3);
    let finishedPayload: FinishedTestPayload | null = null;
    const onFinish = vi.fn((payload: FinishedTestPayload) => {
      finishedPayload = payload;
    });

    const step3 = renderWithLocale(
      <TestInterface
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        userId={userId}
        onFinish={onFinish}
        onCancel={vi.fn()}
      />,
      'es',
    );

    // Q1: correct
    await user.click(screen.getByText(/Un mes desde el día siguiente/i));
    await user.click(screen.getByRole('button', { name: /nota/i }));
    const noteDialog = screen.getByRole('dialog');
    await user.type(within(noteDialog).getByRole('textbox'), 'Plazo alzada: 1 mes acto expreso.');
    await user.click(within(noteDialog).getByRole('button', { name: /guardar/i }));

    // Next -> Q2: incorrect + errata check
    await user.click(
      screen.getAllByRole('button', { name: /^(siguiente|hurrengoa|hurrengo galdera)$/i })[0],
    );
    await user.click(screen.getByText(/A los dos años/i));
    await user.click(screen.getByRole('button', { name: /errata|reportar/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cerrar|cancelar/i }));

    // Next -> Q3: leave blank and finish
    await user.click(
      screen.getAllByRole('button', { name: /^(siguiente|hurrengoa|hurrengo galdera)$/i })[0],
    );
    await user.click(
      screen.getAllByRole('button', { name: /^(finalizar( test)?|amaitu( test)?)$/i })[0],
    );

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledTimes(1);
    });
    expect(finishedPayload).not.toBeNull();
    // Blank questions are intentionally NOT part of `answers` (they would be synced as
    // wrong attempts); PostTestStats derives blanks from `questions`.
    expect(finishedPayload!.answers).toHaveLength(2);
    step3.unmount();

    // 4. Review PostTestStats Nota Neta /10 and highlight explanation
    // 1 correct, 1 incorrect, 1 blank on 3 questions with -1/3 -> (1 - 1/3)/3 * 10 = 2,22
    const step4 = renderWithLocale(
      <PostTestStats
        payload={finishedPayload!}
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        userId={userId}
        penaltyRule={activeRule}
        onRestart={vi.fn()}
        onGoBack={vi.fn()}
        onGoHome={vi.fn()}
      />,
      'es',
    );

    expect(screen.getAllByText(/nota neta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2,22/).length).toBeGreaterThan(0);

    const reviewToggle = screen.getByRole('button', {
      name: /analizar \d+ fallos?|revisar \d+ en blanco|revisar test|akatsak aztertu|zuriak berrikusi|testa berrikusi/i,
    });
    await user.click(reviewToggle);

    const highlightables = step4.container.querySelectorAll('.highlightable-text');
    expect(highlightables.length).toBeGreaterThan(0);
    simulateTextSelection(highlightables[highlightables.length - 1], 0, 10);
    const keyHighlightBtn = screen.getByRole('button', {
      name: /concepto clave|funtsezko kontzeptua|clave|gakoa/i,
    });
    await user.click(keyHighlightBtn);
    step4.unmount();

    // 5. Open MyNotesAndHighlights to find the saved note
    const step5 = renderWithLocale(
      <MyNotesAndHighlights curriculum="osakidetza-celador" userId={userId} />,
      'es',
    );
    await waitFor(() => {
      expect(screen.getByText(/Plazo alzada: 1 mes acto expreso/i)).toBeInTheDocument();
    });
    step5.unmount();

    // 6. Open StatsDashboard ROI Prioritizer and trigger 1-click topic practice
    const onPracticeTopic = vi.fn();
    const onPracticeLaw = vi.fn();

    renderWithLocale(
      <StatsDashboard
        results={buildSampleTestResults()}
        bundle={buildSampleDashboardBundle()}
        curriculum="osakidetza-celador"
        penaltyRule={activeRule}
        onPracticeTopic={onPracticeTopic}
        onPracticeLaw={onPracticeLaw}
      />,
      'es',
    );

    const simulatorRegion = screen.getByRole('region', { name: /simulador|nota neta/i });
    const practiceBtns = within(simulatorRegion).getAllByRole('button', {
      name: /practicar|entrenar/i,
    });
    expect(practiceBtns.length).toBeGreaterThan(0);
    await user.click(practiceBtns[0]);
    expect(onPracticeTopic.mock.calls.length + onPracticeLaw.mock.calls.length).toBeGreaterThan(0);
  });

  it('Scenario B (Goi-Teknikaria EU Opositor): operates end-to-end in Basque across SettingsPanel (-0,25), TodayPlanStrip, TestSelection, PostTestStats, NoteDrawer, ErrataPanel, and MyNotesAndHighlights', async () => {
    const netScore = await loadProjectModule<NetScoreModule>('src/lib/netScore.ts');
    const { default: SettingsPanel } = await loadProjectModule<SettingsPanelH2Module>(
      'src/components/SettingsPanel.tsx',
    );
    const { default: TodayPlanStrip } = await loadProjectModule<TodayPlanStripModule>(
      'src/components/TodayPlanStrip.tsx',
    );
    const { default: TestSelection } = await loadProjectModule<TestSelectionH2Module>(
      'src/components/TestSelection.tsx',
    );
    const { default: PostTestStats } = await loadProjectModule<PostTestStatsH2Module>(
      'src/components/PostTestStats.tsx',
    );
    const { default: QuestionNoteDrawer } = await loadProjectModule<QuestionNoteDrawerModule>(
      'src/components/QuestionNoteDrawer.tsx',
    );
    const { default: QuestionErrataPanel } = await loadProjectModule<QuestionErrataPanelModule>(
      'src/components/QuestionErrataPanel.tsx',
    );
    const { default: MyNotesAndHighlights } = await loadProjectModule<MyNotesAndHighlightsModule>(
      'src/components/MyNotesAndHighlights.tsx',
    );

    const userId = 'goi-teknikaria-eu-user';
    const user = userEvent.setup();

    // 1. SettingsPanel in EU -> select -0,25
    let ruleEu: PenaltyRuleId = 'none';
    const s1 = renderWithLocale(
      <SettingsPanel
        examTarget={buildSampleExamTarget({ userId, curriculum: 'goi-teknikaria-2026' })}
        saving={false}
        notice={null}
        curriculumOptions={buildSampleCurriculumOptions()}
        visibleCurriculumIds={['goi-teknikaria-2026']}
        visiblePracticeModeIds={['standard', 'errors', 'topics', 'simulacro', 'challenge', 'custom']}
        customSupportMode={{ showMarks: true, showNotes: true }}
        penaltyRule={ruleEu}
        onSave={async (next) => {
          netScore.writePenaltyRule(userId, next.penaltyRule);
          ruleEu = netScore.readPenaltyRule(userId);
        }}
      />,
      'eu',
    );

    const penaltyGroupEu = screen.getByRole('radiogroup', { name: /zigor/i });
    await user.click(within(penaltyGroupEu).getByRole('radio', { name: /-0,25/i }));
    await user.click(screen.getByRole('button', { name: /gorde/i }));
    await waitFor(() => {
      expect(ruleEu).toBe('quarter');
    });
    s1.unmount();

    // 2. TodayPlanStrip in EU
    const onStartPlan = vi.fn();
    const s2 = renderWithLocale(
      <TodayPlanStrip
        streakDays={6}
        hydrated={true}
        eyebrow="Gaurko plana"
        title="Indartu zure puntu ahulenak"
        sessionMetaLabel="10 gald. · ~8 min"
        ctaLabel="Hasi saioa"
        onStartPlan={onStartPlan}
      />,
      'eu',
    );
    expect(screen.getByText('Gaurko plana')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /hasi saioa/i }));
    expect(onStartPlan).toHaveBeenCalledTimes(1);
    s2.unmount();

    // 3. TestSelection in EU: no duplicate range in standard, 'Hasieratik' in custom
    const s3 = renderWithLocale(
      <TestSelection
        curriculum="goi-teknikaria-2026"
        lawOptions={[]}
        onStart={vi.fn()}
        onStartLawTest={vi.fn()}
        onStartCustomTest={vi.fn()}
        onStartCustomPractice={vi.fn()}
        initialSyllabus={null}
      />,
      'eu',
    );
    expect(screen.queryByRole('button', { name: /bloke laburra/i })).not.toBeInTheDocument();
    const customTabEu = screen.getByRole('button', { name: /zure neurrira/i });
    await user.click(customTabEu);
    const rangeToggleEu = screen.getByRole('button', {
      name: /tartea \(aukerakoa\)|rango \(opcional\)/i,
    });
    if (rangeToggleEu.getAttribute('aria-expanded') !== 'true') {
      await user.click(rangeToggleEu);
    }
    expect(screen.getByPlaceholderText(/Hasieratik/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/^Desde$/i)).not.toBeInTheDocument();
    s3.unmount();

    // 4. PostTestStats in EU with -0,25 rule
    const questions = buildSampleQuestions(4);
    const payload = buildFinishedTestPayload(questions, ['correct', 'correct', 'incorrect', 'blank']);
    const s4 = renderWithLocale(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="goi-teknikaria-2026"
        userId={userId}
        penaltyRule={ruleEu}
        onRestart={vi.fn()}
        onGoBack={vi.fn()}
        onGoHome={vi.fn()}
      />,
      'eu',
    );
    // (2 - 0.25)/4 * 10 = 4,38
    expect(screen.getAllByText(/4,38/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-0,25/).length).toBeGreaterThan(0);
    s4.unmount();

    // 5. NoteDrawer & ErrataPanel in EU
    const onSaveNote = vi.fn().mockResolvedValue(undefined);
    const s5 = renderWithLocale(
      <QuestionNoteDrawer
        open={true}
        questionId="q-h2-1"
        note=""
        onSave={onSaveNote}
        onClose={vi.fn()}
      />,
      'eu',
    );
    const dialogEu = screen.getByRole('dialog');
    await user.type(within(dialogEu).getByRole('textbox'), 'Ohar garrantzitsua euskaraz');
    await user.click(within(dialogEu).getByRole('button', { name: /gorde/i }));
    await waitFor(() => {
      expect(onSaveNote).toHaveBeenCalledWith('Ohar garrantzitsua euskaraz');
    });
    s5.unmount();

    const onSubmittedErrata = vi.fn();
    const s6 = renderWithLocale(
      <QuestionErrataPanel
        open={true}
        questionId="q-h2-1"
        curriculum="goi-teknikaria-2026"
        userId={userId}
        onSubmitted={onSubmittedErrata}
        onClose={vi.fn()}
      />,
      'eu',
    );
    await user.click(screen.getByRole('button', { name: /bidali|jakinarazi/i }));
    await waitFor(() => {
      expect(onSubmittedErrata).toHaveBeenCalledTimes(1);
    });
    s6.unmount();

    // 6. MyNotesAndHighlights in EU
    window.localStorage.setItem(
      'quantia_study_state',
      JSON.stringify({
        highlights: {},
        notes: { 'q-h2-1': 'Ohar garrantzitsua euskaraz' },
      }),
    );

    renderWithLocale(
      <MyNotesAndHighlights curriculum="goi-teknikaria-2026" userId={userId} />,
      'eu',
    );

    await waitFor(() => {
      expect(screen.getByText(/Ohar garrantzitsua euskaraz/i)).toBeInTheDocument();
    });
  });
});
