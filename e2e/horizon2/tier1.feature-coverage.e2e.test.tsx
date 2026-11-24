import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import {
  loadProjectModule,
  type CoachH2Module,
  type MyNotesAndHighlightsModule,
  type NetScoreModule,
  type NetScoreSimulatorCardModule,
  type PostTestStatsH2Module,
  type PracticeModeVisibilityH2Module,
  type QuantiaApiH2Module,
  type QuestionBankApiH2Module,
  type QuestionErrataApiModule,
  type QuestionErrataPanelModule,
  type QuestionNoteDrawerModule,
  type SettingsPanelH2Module,
  type StatsDashboardH2Module,
  type StudySubNavModule,
  type TestInterfaceH2Module,
  type TestSelectionH2Module,
  type TodayPlanStripModule,
  type UseStudyAnnotationsModule,
} from './helpers/loadModule';
import {
  buildFinishedTestPayload,
  buildSampleCurriculumOptions,
  buildSampleDashboardBundle,
  buildSampleExamTarget,
  buildSampleQuestions,
  buildSampleStudyData,
  buildSampleTestResults,
  buildSampleTopicInsightItems,
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

describe('Horizonte 2 — Tier 1: Isolated Feature Coverage (F1–F17)', () => {
  beforeEach(() => {
    resetE2EEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('F1: netScore.ts calculates net score across 0 / -0,25 / -0,33, simulates exams, ranks ROI, and persists per-user rule', async () => {
    const netScore = await loadProjectModule<NetScoreModule>('src/lib/netScore.ts');

    expect(netScore.PENALTY_RULES.none.factor).toBe(0);
    expect(netScore.PENALTY_RULES.quarter.factor).toBe(0.25);
    expect(netScore.PENALTY_RULES.third.factor).toBeCloseTo(1 / 3, 10);

    const noneRes = netScore.calculateNetScore({
      correct: 7,
      incorrect: 3,
      unanswered: 0,
      total: 10,
      penaltyRule: 'none',
    });
    expect(noneRes.scoreBase10).toBeCloseTo(7, 5);
    expect(noneRes.penaltyLostPoints).toBe(0);

    const quarterRes = netScore.calculateNetScore({
      correct: 8,
      incorrect: 2,
      unanswered: 0,
      total: 10,
      penaltyRule: 'quarter',
    });
    expect(quarterRes.rawNetPoints).toBeCloseTo(7.5, 5);
    expect(quarterRes.scoreBase10).toBeCloseTo(7.5, 5);
    expect(quarterRes.penaltyLostPoints).toBeCloseTo(0.5, 5);

    const thirdRes = netScore.calculateNetScore({
      correct: 7,
      incorrect: 3,
      unanswered: 0,
      total: 10,
      penaltyRule: 'third',
    });
    expect(thirdRes.rawNetPoints).toBeCloseTo(6, 10);
    expect(thirdRes.scoreBase10).toBeCloseTo(6, 10);

    const sim = netScore.simulateExamNetScore({
      examQuestions: 100,
      accuracyRate: 0.75,
      answerRate: 0.8,
      penaltyRule: 'third',
      targetScoreBase10: 5,
    });
    expect(sim.answeredCount).toBe(80);
    expect(sim.blankCount).toBe(20);
    expect(sim.byRule.none.scoreBase10).toBeGreaterThan(sim.byRule.quarter.scoreBase10);
    expect(sim.byRule.quarter.scoreBase10).toBeGreaterThan(sim.byRule.third.scoreBase10);
    expect(sim.meetsTarget).toBe(true);

    const roi = netScore.buildTopicRoiPriorities({
      topics: buildSampleTopicInsightItems(),
      penaltyRule: 'third',
      limit: 5,
    });
    expect(roi.length).toBeGreaterThan(0);
    expect(roi.length).toBeLessThanOrEqual(5);
    expect(roi[0].roiScore).toBeGreaterThanOrEqual(roi[roi.length - 1].roiScore);

    expect(netScore.readPenaltyRule('user-a')).toBe('none');
    netScore.writePenaltyRule('user-a', 'third');
    netScore.writePenaltyRule('user-b', 'quarter');
    expect(window.localStorage.getItem('quantia.penalty-rule.v1:user-a')).toBe('third');
    expect(netScore.readPenaltyRule('user-a')).toBe('third');
    expect(netScore.readPenaltyRule('user-b')).toBe('quarter');
  });

  it('F2: SettingsPanel renders 0 / -0,25 / -0,33 options, selects -0,33, and passes penaltyRule="third" to onSave', async () => {
    const { default: SettingsPanel } = await loadProjectModule<SettingsPanelH2Module>(
      'src/components/SettingsPanel.tsx',
    );
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithLocale(
      <SettingsPanel
        examTarget={buildSampleExamTarget()}
        saving={false}
        notice={null}
        curriculumOptions={buildSampleCurriculumOptions()}
        visibleCurriculumIds={['osakidetza-celador']}
        visiblePracticeModeIds={['standard', 'errors', 'topics', 'simulacro', 'challenge', 'custom']}
        customSupportMode={{ showMarks: true, showNotes: true }}
        penaltyRule="none"
        onSave={onSave}
      />,
      'es',
    );

    const penaltyGroup = screen.getByRole('radiogroup', { name: /penaliz/i });
    expect(within(penaltyGroup).getByRole('radio', { name: /sin penalización/i })).toBeInTheDocument();
    expect(within(penaltyGroup).getByRole('radio', { name: /-0,25/i })).toBeInTheDocument();
    const thirdRadio = within(penaltyGroup).getByRole('radio', { name: /-0,33/i });
    expect(thirdRadio).toBeInTheDocument();

    await user.click(thirdRadio);

    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0].penaltyRule).toBe('third');
  });

  it('F3: PostTestStats displays Nota Neta /10, penalty loss vs blanks callout, and per-law net score', async () => {
    const { default: PostTestStats } = await loadProjectModule<PostTestStatsH2Module>(
      'src/components/PostTestStats.tsx',
    );
    const questions = buildSampleQuestions(4);
    // 2 correct, 1 incorrect, 1 blank -> quarter: (2 - 0.25)/4 * 10 = 4,38; third: (2 - 1/3)/4 * 10 = 4,17
    const payload = buildFinishedTestPayload(questions, ['correct', 'incorrect', 'correct', 'blank']);

    const { unmount } = renderWithLocale(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        penaltyRule="quarter"
        onRestart={vi.fn()}
        onGoBack={vi.fn()}
        onGoHome={vi.fn()}
      />,
      'es',
    );

    expect(screen.getAllByText(/nota neta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4,38/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-0,25/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/en blanco|penaliz/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ley 39\/2015/i).length).toBeGreaterThan(0);

    unmount();

    renderWithLocale(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        penaltyRule="third"
        onRestart={vi.fn()}
        onGoBack={vi.fn()}
        onGoHome={vi.fn()}
      />,
      'es',
    );

    expect(screen.getAllByText(/4,17/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-0,33/).length).toBeGreaterThan(0);
  });

  it('F4: NetScoreSimulatorCard & StatsDashboard render simulator controls, 3-rule comparison, Top-5 ROI, live rule switch, and 1-click practice', async () => {
    const { default: NetScoreSimulatorCard } = await loadProjectModule<NetScoreSimulatorCardModule>(
      'src/components/stats/NetScoreSimulatorCard.tsx',
    );
    const { default: StatsDashboard } = await loadProjectModule<StatsDashboardH2Module>(
      'src/components/StatsDashboard.tsx',
    );
    const onChangePenaltyRule = vi.fn();
    const onPracticeTopic = vi.fn();
    const onPracticeLaw = vi.fn();
    const user = userEvent.setup();

    const { unmount } = renderWithLocale(
      <NetScoreSimulatorCard
        penaltyRule="quarter"
        readinessPct={64}
        observedAccuracyPct={72}
        topicInsights={buildSampleTopicInsightItems()}
        lawBreakdown={[]}
        singleScope={false}
        lawCurriculum={false}
        onChangePenaltyRule={onChangePenaltyRule}
        onPracticeTopic={onPracticeTopic}
        onPracticeLaw={onPracticeLaw}
      />,
      'es',
    );

    expect(screen.getAllByText(/-0,25/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-0,33/).length).toBeGreaterThan(0);

    const thirdRuleButton = screen.getAllByRole('button', { name: /-0,33/i })[0];
    await user.click(thirdRuleButton);
    expect(onChangePenaltyRule).toHaveBeenCalledWith('third');

    const practiceButtons = screen.getAllByRole('button', { name: /practicar|entrenar/i });
    expect(practiceButtons.length).toBeGreaterThan(0);
    await user.click(practiceButtons[0]);
    expect(onPracticeTopic.mock.calls.length + onPracticeLaw.mock.calls.length).toBeGreaterThan(0);

    unmount();

    renderWithLocale(
      <StatsDashboard
        results={buildSampleTestResults()}
        bundle={buildSampleDashboardBundle()}
        curriculum="osakidetza-celador"
        penaltyRule="third"
        onChangePenaltyRule={onChangePenaltyRule}
        onPracticeTopic={onPracticeTopic}
        onPracticeLaw={onPracticeLaw}
      />,
      'es',
    );

    expect(screen.getAllByText(/simulador|nota neta/i).length).toBeGreaterThan(0);
  });

  it('F7: TodayPlanStrip renders streak days, eyebrow, title, subtitle, sessionMetaLabel, and triggers onStartPlan on CTA click', async () => {
    const { default: TodayPlanStrip } = await loadProjectModule<TodayPlanStripModule>(
      'src/components/TodayPlanStrip.tsx',
    );
    const onStartPlan = vi.fn();
    const user = userEvent.setup();

    renderWithLocale(
      <TodayPlanStrip
        streakDays={7}
        hydrated={true}
        eyebrow="Tu plan de hoy"
        title="Repasa tus 14 preguntas pendientes"
        subtitle="Prioriza Ley 39/2015 para proteger tu nota neta."
        sessionMetaLabel="15 preg. · ~10 min"
        ctaLabel="Empezar sesión"
        tone="protect"
        onStartPlan={onStartPlan}
      />,
      'es',
    );

    expect(screen.getByText(/7/)).toBeInTheDocument();
    expect(screen.getByText('Tu plan de hoy')).toBeInTheDocument();
    expect(screen.getByText('Repasa tus 14 preguntas pendientes')).toBeInTheDocument();
    expect(screen.getByText(/Prioriza Ley 39\/2015/i)).toBeInTheDocument();
    expect(screen.getByText('15 preg. · ~10 min')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /empezar sesión/i }));
    expect(onStartPlan).toHaveBeenCalledTimes(1);
  });

  it('F8: TestSelection absorbs quick into standard [5, 10, 20, 50], removes duplicate numeric range from standard, and keeps range in custom', async () => {
    const { default: TestSelection } = await loadProjectModule<TestSelectionH2Module>(
      'src/components/TestSelection.tsx',
    );
    const onStart = vi.fn();
    const user = userEvent.setup();

    renderWithLocale(
      <TestSelection
        curriculum="osakidetza-celador"
        lawOptions={['Ley 39/2015', 'Estatuto Marco']}
        onStart={onStart}
        onStartLawTest={vi.fn()}
        onStartCustomTest={vi.fn()}
        onStartCustomPractice={vi.fn()}
        initialSyllabus={null}
      />,
      'es',
    );

    expect(screen.queryByRole('button', { name: /bloque corto/i })).not.toBeInTheDocument();

    const standardTab = screen.getByRole('button', { name: /test por temario/i });
    await user.click(standardTab);

    expect(screen.getByRole('button', { name: /^5(\b|rápido|azkar)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^10\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^20\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^50\b/i })).toBeInTheDocument();

    // Standard mode must not expose the duplicate numeric range selector
    expect(screen.queryByLabelText(/desde/i)).not.toBeInTheDocument();

    // Custom mode retains numeric range
    const customTab = screen.getByRole('button', { name: /a tu medida/i });
    await user.click(customTab);
    expect(screen.getByText(/rango|desde/i)).toBeInTheDocument();
  });

  it('F9: practiceModeVisibility excludes "quick" from PRACTICE_MODE_IDS and retains the 6 canonical modes', async () => {
    const mod = await loadProjectModule<PracticeModeVisibilityH2Module>(
      'src/lib/practiceModeVisibility.ts',
    );

    expect(mod.PRACTICE_MODE_IDS).not.toContain('quick');
    expect(new Set(mod.PRACTICE_MODE_IDS)).toEqual(
      new Set(['standard', 'errors', 'topics', 'simulacro', 'challenge', 'custom']),
    );
    expect(mod.PRACTICE_MODE_IDS).toHaveLength(6);
  });

  it('F10: coach.ts supports bilingual ES (with proper Spanish accents) and EU outputs', async () => {
    const coach = await loadProjectModule<CoachH2Module>('src/lib/coach.ts');
    const bundle = buildSampleDashboardBundle();
    const baseInput = {
      learningDashboard: null,
      learningDashboardV2: bundle.practiceState.learningDashboardV2,
      pressureInsights: null,
      pressureInsightsV2: null,
      examTarget: bundle.practiceState.examTarget,
      recentSessions: bundle.practiceState.recentSessions,
      recommendedBatchNumber: 1,
      totalBatches: 10,
      batchSize: 20,
    };

    const planEs = coach.buildCoachPlanV2({ ...baseInput, locale: 'es' });
    const msgEs = coach.buildCoachTwoLineMessageV2(planEs, { locale: 'es' });
    expect(planEs.reasons.length).toBeGreaterThan(0);
    expect(msgEs.line1.length).toBeGreaterThan(0);
    expect(msgEs.line2.length).toBeGreaterThan(0);
    const esText = `${planEs.reasons.join(' ')} ${msgEs.text}`;
    expect(esText).not.toMatch(/\bsesion\b/i);
    expect(esText).toMatch(/[áéíóúñ]/i);

    const planEu = coach.buildCoachPlanV2({ ...baseInput, locale: 'eu' });
    const msgEu = coach.buildCoachTwoLineMessageV2(planEu, { locale: 'eu' });
    expect(planEu.reasons.length).toBeGreaterThan(0);
    expect(msgEu.text).not.toBe(msgEs.text);
    expect(`${planEu.reasons.join(' ')} ${msgEu.text}`).toMatch(
      /saio|errepas|galdera|zuzendu|finkatu|aurrera|azterketa/i,
    );
  });

  it('F12: getAllUserStudyData returns saved highlights & notes, and getQuestionsByIds returns Record<string, Question>', async () => {
    const quantiaApi = await loadProjectModule<QuantiaApiH2Module>('src/lib/quantiaApi.ts');
    const questionBankApi = await loadProjectModule<QuestionBankApiH2Module>(
      'src/lib/questionBankApi.ts',
    );

    const sampleStudy = buildSampleStudyData();
    window.localStorage.setItem('quantia_study_state', JSON.stringify(sampleStudy));

    expect(typeof quantiaApi.getAllUserStudyData).toBe('function');
    const library = await quantiaApi.getAllUserStudyData();
    expect(library.notes['q-h2-1']).toContain('acto expreso');
    expect(library.highlights['q-h2-1']).toHaveLength(1);

    expect(typeof questionBankApi.getQuestionsByIds).toBe('function');
    const emptyLookup = await questionBankApi.getQuestionsByIds([]);
    expect(emptyLookup).toEqual({});
  });

  it('F13: useStudyAnnotations & QuestionNoteDrawer open dialog, save, and delete notes cleanly', async () => {
    const { useStudyAnnotations } = await loadProjectModule<UseStudyAnnotationsModule>(
      'src/hooks/useStudyAnnotations.ts',
    );
    const { default: QuestionNoteDrawer } = await loadProjectModule<QuestionNoteDrawerModule>(
      'src/components/QuestionNoteDrawer.tsx',
    );
    expect(typeof useStudyAnnotations).toBe('function');

    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();

    const { rerender } = renderWithLocale(
      <QuestionNoteDrawer
        open={true}
        questionId="q-h2-1"
        questionNumber={1}
        note=""
        onSave={onSave}
        onClose={onClose}
      />,
      'es',
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const textarea = within(dialog).getByRole('textbox');
    await user.type(textarea, 'Art. 122.1 Ley 39/2015: 1 mes acto expreso.');
    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Art. 122.1 Ley 39/2015: 1 mes acto expreso.');
    });

    rerender(
      <QuestionNoteDrawer
        open={true}
        questionId="q-h2-1"
        questionNumber={1}
        note="Nota existente"
        onSave={onSave}
        onClose={onClose}
      />,
    );

    const deleteBtn = within(screen.getByRole('dialog')).getByRole('button', {
      name: /eliminar|borrar/i,
    });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('');
    });
  });

  it('F14: questionErrataApi & QuestionErrataPanel render 5 categories, submit errata, show confirmation, and retrieve reports', async () => {
    const errataApi = await loadProjectModule<QuestionErrataApiModule>(
      'src/lib/questionErrataApi.ts',
    );
    const { default: QuestionErrataPanel } = await loadProjectModule<QuestionErrataPanelModule>(
      'src/components/QuestionErrataPanel.tsx',
    );
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    renderWithLocale(
      <QuestionErrataPanel
        open={true}
        questionId="q-h2-1"
        curriculum="osakidetza-celador"
        userId="user-h2-1"
        onSubmitted={onSubmitted}
        onClose={vi.fn()}
      />,
      'es',
    );

    // 5 errata categories must be selectable
    const radioControls = screen.queryAllByRole('radio');
    const categoryControls = radioControls.length > 0
      ? radioControls
      : screen.queryAllByRole('option');
    expect(categoryControls.length).toBeGreaterThanOrEqual(5);

    const commentBox = screen.getByRole('textbox');
    await user.type(commentBox, 'El artículo citado fue modificado en 2023.');
    await user.click(screen.getByRole('button', { name: /enviar|reportar|guardar/i }));

    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/reportad|enviad|recibid|gracias/i)).toBeInTheDocument();

    const reportsByQ = await errataApi.getUserErrataReportsForQuestions(['q-h2-1'], 'user-h2-1');
    expect(reportsByQ['q-h2-1']?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('F15: TestInterface enables highlighting, note drawer, and errata panel after answering in non-simulacro mode', async () => {
    const { default: TestInterface } = await loadProjectModule<TestInterfaceH2Module>(
      'src/components/TestInterface.tsx',
    );
    const questions = buildSampleQuestions(2);
    const user = userEvent.setup();

    const { container } = renderWithLocale(
      <TestInterface
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        userId="user-h2-1"
        onFinish={vi.fn()}
        onCancel={vi.fn()}
      />,
      'es',
    );

    // Answer question 1
    await user.click(screen.getByText(/Un mes desde el día siguiente/i));

    // Highlightable text should be present and not blocked by a disabled button wrapper
    const highlightable = container.querySelector('.highlightable-text');
    expect(highlightable).toBeTruthy();
    expect(highlightable?.closest('button[disabled]')).toBeNull();

    if (highlightable) {
      simulateTextSelection(highlightable, 0, 10);
      expect(screen.getByText('Clave')).toBeInTheDocument();
    }

    // Open note drawer
    const noteBtn = screen.getByRole('button', { name: /nota/i });
    await user.click(noteBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close note drawer and open errata panel
    const closeBtn = within(screen.getByRole('dialog')).getByRole('button', {
      name: /cerrar|cancelar/i,
    });
    await user.click(closeBtn);

    const errataBtn = screen.getByRole('button', { name: /errata|reportar/i });
    await user.click(errataBtn);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('F16: PostTestStats showReview allows highlighting on stem/options/explanation, saving a note, and reporting an errata', async () => {
    const { default: PostTestStats } = await loadProjectModule<PostTestStatsH2Module>(
      'src/components/PostTestStats.tsx',
    );
    const questions = buildSampleQuestions(2);
    const payload = buildFinishedTestPayload(questions, ['correct', 'incorrect']);
    const user = userEvent.setup();

    const { container } = renderWithLocale(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        userId="user-h2-1"
        penaltyRule="quarter"
        onRestart={vi.fn()}
        onGoBack={vi.fn()}
        onGoHome={vi.fn()}
      />,
      'es',
    );

    // Open review panel
    const reviewToggle = screen.getByRole('button', {
      name: /analizar \d+ fallos?|revisar \d+ en blanco|revisar test|akatsak aztertu|zuriak berrikusi|testa berrikusi/i,
    });
    await user.click(reviewToggle);

    const highlightables = container.querySelectorAll('.highlightable-text');
    expect(highlightables.length).toBeGreaterThanOrEqual(2);
    simulateTextSelection(highlightables[0], 0, 12);
    const keyHighlightBtn = screen.getByRole('button', {
      name: /concepto clave|funtsezko kontzeptua|clave|gakoa/i,
    });
    await user.click(keyHighlightBtn);

    const noteButtons = screen.getAllByRole('button', { name: /nota/i });
    await user.click(noteButtons[0]);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Nota desde post-test');
    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    const errataButtons = screen.getAllByRole('button', { name: /errata|reportar/i });
    expect(errataButtons.length).toBeGreaterThan(0);
    await user.click(errataButtons[0]);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('F17: StudySubNav renders 3 tabs and MyNotesAndHighlights lists, filters, edits, deletes, and jumps to study', async () => {
    const { default: StudySubNav } = await loadProjectModule<StudySubNavModule>(
      'src/components/StudySubNav.tsx',
    );
    const { default: MyNotesAndHighlights } = await loadProjectModule<MyNotesAndHighlightsModule>(
      'src/components/MyNotesAndHighlights.tsx',
    );

    const onSelectView = vi.fn();
    const user = userEvent.setup();

    const { unmount } = renderWithLocale(
      <StudySubNav activeView="study-bank" onSelectView={onSelectView} notesCount={2} />,
      'es',
    );

    const navButtons = screen.getAllByRole('button');
    expect(navButtons.length).toBeGreaterThanOrEqual(3);
    const notesTab = screen.getByRole('button', { name: /mis notas|notas y subrayados/i });
    await user.click(notesTab);
    expect(onSelectView).toHaveBeenCalledWith('study-notes');

    unmount();

    window.localStorage.setItem('quantia_study_state', JSON.stringify(buildSampleStudyData()));
    const onJumpToQuestion = vi.fn();

    renderWithLocale(
      <MyNotesAndHighlights
        curriculum="osakidetza-celador"
        userId="user-h2-1"
        onJumpToQuestion={onJumpToQuestion}
      />,
      'es',
    );

    await waitFor(() => {
      expect(screen.getByText(/acto expreso/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Estatuto Marco/i)).toBeInTheDocument();

    const searchInput = screen.queryByRole('searchbox', { hidden: true }) ??
      screen.getByPlaceholderText(/buscar/i);
    await user.type(searchInput, 'acto expreso');
    await waitFor(() => {
      expect(screen.getByText(/acto expreso/i)).toBeInTheDocument();
      expect(screen.queryByText(/Faltas muy graves prescriben/i)).not.toBeInTheDocument();
    });

    await user.clear(searchInput);

    // Inline note edit
    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButtons[0]);
    const editBox = screen.getByRole('textbox');
    await user.clear(editBox);
    await user.type(editBox, 'Nota editada inline en biblioteca');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nota editada inline en biblioteca/i)).toBeInTheDocument();
    });

    // Inline note delete
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar|borrar/i });
    await user.click(deleteButtons[0]);
    const confirmDelete = screen.queryByRole('button', {
      name: /confirmar|sí, eliminar|eliminar nota/i,
    });
    if (confirmDelete) {
      await user.click(confirmDelete);
    }
    await waitFor(() => {
      expect(screen.queryByText(/Nota editada inline en biblioteca/i)).not.toBeInTheDocument();
    });

    const jumpButtons = screen.getAllByRole('button', { name: /ir a|estudiar|abrir|ver pregunta/i });
    await user.click(jumpButtons[0]);
    expect(onJumpToQuestion).toHaveBeenCalled();
  });
});
