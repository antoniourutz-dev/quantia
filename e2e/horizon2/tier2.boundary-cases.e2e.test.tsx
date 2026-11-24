import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  loadProjectModule,
  type CoachH2Module,
  type MyNotesAndHighlightsModule,
  type NetScoreModule,
  type PracticeModeVisibilityH2Module,
  type QuantiaApiH2Module,
  type QuestionBankApiH2Module,
  type QuestionErrataApiModule,
  type QuestionErrataPanelModule,
  type QuestionNoteDrawerModule,
  type SettingsPanelH2Module,
  type TestInterfaceH2Module,
  type TestSelectionH2Module,
  type TodayPlanStripModule,
} from './helpers/loadModule';
import {
  buildSampleCurriculumOptions,
  buildSampleDashboardBundle,
  buildSampleExamTarget,
  buildSampleQuestions,
  buildSampleStudyData,
  renderWithLocale,
  resetE2EEnvironment,
} from './helpers/fixtures';

describe('Horizonte 2 — Tier 2: Boundary & Corner Cases', () => {
  beforeEach(() => {
    resetE2EEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculateNetScore handles 0 questions, all blanks, negative clamping to 0,00 / 10, and exact 1/3 deduction', async () => {
    const netScore = await loadProjectModule<NetScoreModule>('src/lib/netScore.ts');

    // 0 questions
    const zero = netScore.calculateNetScore({
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      total: 0,
      penaltyRule: 'third',
    });
    expect(zero.scoreBase10).toBe(0);
    expect(zero.netPct).toBe(0);
    expect(Number.isNaN(zero.scoreBase10)).toBe(false);

    // All blanks
    const allBlank = netScore.calculateNetScore({
      correct: 0,
      incorrect: 0,
      unanswered: 10,
      total: 10,
      penaltyRule: 'third',
    });
    expect(allBlank.scoreBase10).toBe(0);
    expect(allBlank.penaltyLostPoints).toBe(0);
    expect(allBlank.unanswered).toBe(10);

    // Negative raw net score clamped to 0,00 / 10
    const clamped = netScore.calculateNetScore({
      correct: 1,
      incorrect: 9,
      unanswered: 0,
      total: 10,
      penaltyRule: 'third',
    });
    expect(clamped.rawNetPoints).toBeLessThan(0);
    expect(clamped.clampedNetPoints).toBe(0);
    expect(clamped.scoreBase10).toBe(0);
    expect(netScore.formatNetScore(clamped.scoreBase10)).toBe('0,00');

    // Exact 1/3 deduction on 3 errors: 7 - (3 * 1/3) = 6.00 (not 6.01)
    const exactThird = netScore.calculateNetScore({
      correct: 7,
      incorrect: 3,
      unanswered: 0,
      total: 10,
      penaltyRule: 'third',
    });
    expect(exactThird.scoreBase10).toBeCloseTo(6, 10);
    expect(netScore.formatNetScore(exactThird.scoreBase10)).toBe('6,00');
  });

  it('practiceModeVisibility migrates legacy "quick" to "standard" in normalizePracticeModeIds and v1/v2 localStorage without duplicates', async () => {
    const mod = await loadProjectModule<PracticeModeVisibilityH2Module>(
      'src/lib/practiceModeVisibility.ts',
    );

    const migrated = mod.normalizePracticeModeIds(['quick', 'errors']);
    expect(migrated).toContain('standard');
    expect(migrated).not.toContain('quick');

    const deduped = mod.normalizePracticeModeIds(['quick', 'standard', 'quick', 'simulacro']);
    expect(deduped.filter((id) => id === 'standard')).toHaveLength(1);
    expect(deduped).not.toContain('quick');

    // v2 storage with legacy 'quick'
    window.localStorage.setItem(
      'quantia.visible-practice-modes.v2:u-mig-2',
      JSON.stringify(['quick', 'standard', 'errors']),
    );
    const fromV2 = mod.readVisiblePracticeModeIds('u-mig-2');
    expect(fromV2).toContain('standard');
    expect(fromV2).not.toContain('quick');
    expect(fromV2.filter((id) => id === 'standard')).toHaveLength(1);

    // v1 legacy storage with 'quick'
    window.localStorage.setItem(
      'quantia.visible-practice-modes.v1:u-mig-1',
      JSON.stringify(['quick', 'simulacro']),
    );
    const fromV1 = mod.readVisiblePracticeModeIds('u-mig-1');
    expect(fromV1).toContain('standard');
    expect(fromV1).not.toContain('quick');
  });

  it('TodayPlanStrip handles streakDays=0, hydrated=false, and disabled=true safely', async () => {
    const { default: TodayPlanStrip } = await loadProjectModule<TodayPlanStripModule>(
      'src/components/TodayPlanStrip.tsx',
    );
    const onStartPlan = vi.fn();
    const user = userEvent.setup();

    const { rerender } = renderWithLocale(
      <TodayPlanStrip
        streakDays={0}
        hydrated={false}
        disabled={true}
        eyebrow="Tu plan de hoy"
        title="Calculando tu plan..."
        ctaLabel="Empezar"
        onStartPlan={onStartPlan}
      />,
      'es',
    );

    const cta = screen.getByRole('button', { name: /empezar/i });
    expect(cta).toBeDisabled();
    await user.click(cta);
    expect(onStartPlan).not.toHaveBeenCalled();

    rerender(
      <TodayPlanStrip
        streakDays={0}
        hydrated={true}
        disabled={false}
        eyebrow="Tu plan de hoy"
        title="Empieza tu primera racha"
        ctaLabel="Empezar"
        onStartPlan={onStartPlan}
      />,
    );

    const activeCta = screen.getByRole('button', { name: /empezar/i });
    expect(activeCta).not.toBeDisabled();
    await user.click(activeCta);
    expect(onStartPlan).toHaveBeenCalledTimes(1);
  });

  it('ES/EU bilingual rendering works across SettingsPanel, TodayPlanStrip, TestSelection, coach, NoteDrawer, ErrataPanel, and MyNotesAndHighlights', async () => {
    const { default: SettingsPanel } = await loadProjectModule<SettingsPanelH2Module>(
      'src/components/SettingsPanel.tsx',
    );
    const { default: TodayPlanStrip } = await loadProjectModule<TodayPlanStripModule>(
      'src/components/TodayPlanStrip.tsx',
    );
    const { default: TestSelection } = await loadProjectModule<TestSelectionH2Module>(
      'src/components/TestSelection.tsx',
    );
    const coach = await loadProjectModule<CoachH2Module>('src/lib/coach.ts');
    const { default: QuestionNoteDrawer } = await loadProjectModule<QuestionNoteDrawerModule>(
      'src/components/QuestionNoteDrawer.tsx',
    );
    const { default: QuestionErrataPanel } = await loadProjectModule<QuestionErrataPanelModule>(
      'src/components/QuestionErrataPanel.tsx',
    );
    const { default: MyNotesAndHighlights } = await loadProjectModule<MyNotesAndHighlightsModule>(
      'src/components/MyNotesAndHighlights.tsx',
    );

    const user = userEvent.setup();

    // 1. SettingsPanel in EU
    const s1 = renderWithLocale(
      <SettingsPanel
        examTarget={buildSampleExamTarget({ curriculum: 'goi-teknikaria-2026' })}
        saving={false}
        notice={null}
        curriculumOptions={buildSampleCurriculumOptions()}
        visibleCurriculumIds={['goi-teknikaria-2026']}
        visiblePracticeModeIds={['standard', 'errors', 'topics', 'simulacro', 'challenge', 'custom']}
        customSupportMode={{ showMarks: true, showNotes: true }}
        penaltyRule="quarter"
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
      'eu',
    );
    expect(screen.getAllByText(/zigor|penalizazio|nota garbia/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-0,25/).length).toBeGreaterThan(0);
    s1.unmount();

    // 2. TodayPlanStrip in EU
    const s2 = renderWithLocale(
      <TodayPlanStrip
        streakDays={4}
        hydrated={true}
        eyebrow="Gaurko plana"
        title="Errepasatu huts egindakoak"
        ctaLabel="Hasi saioa"
        onStartPlan={vi.fn()}
      />,
      'eu',
    );
    expect(screen.getByText('Gaurko plana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hasi saioa/i })).toBeInTheDocument();
    s2.unmount();

    // 3. TestSelection in EU uses 'Hasieratik' instead of Spanish 'Desde'
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
    const customTabEu = screen.getByRole('button', { name: /zure neurrira/i });
    await user.click(customTabEu);
    const rangeToggleEu = screen.getByRole('button', {
      name: /tartea \(aukerakoa\)|rango \(opcional\)/i,
    });
    if (rangeToggleEu.getAttribute('aria-expanded') !== 'true') {
      await user.click(rangeToggleEu);
    }
    expect(screen.queryByPlaceholderText(/^Desde$/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Hasieratik/i)).toBeInTheDocument();
    s3.unmount();

    // 4. Coach in EU
    const bundle = buildSampleDashboardBundle();
    const euPlan = coach.buildCoachPlanV2({
      learningDashboard: null,
      learningDashboardV2: bundle.practiceState.learningDashboardV2,
      pressureInsights: null,
      pressureInsightsV2: null,
      examTarget: bundle.practiceState.examTarget,
      recentSessions: bundle.practiceState.recentSessions,
      recommendedBatchNumber: 1,
      totalBatches: 10,
      batchSize: 20,
      locale: 'eu',
    });
    const euMsg = coach.buildCoachTwoLineMessageV2(euPlan, { locale: 'eu' });
    expect(`${euPlan.reasons.join(' ')} ${euMsg.text}`).toMatch(
      /saio|galdera|errepas|azterketa|finkatu/i,
    );

    // 5. QuestionNoteDrawer in EU
    const s5 = renderWithLocale(
      <QuestionNoteDrawer
        open={true}
        questionId="q-h2-1"
        note=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
      'eu',
    );
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /gorde/i })).toBeInTheDocument();
    s5.unmount();

    // 6. QuestionErrataPanel in EU
    const s6 = renderWithLocale(
      <QuestionErrataPanel
        open={true}
        questionId="q-h2-1"
        curriculum="goi-teknikaria-2026"
        onClose={vi.fn()}
      />,
      'eu',
    );
    expect(screen.getByRole('button', { name: /bidali|jakinarazi/i })).toBeInTheDocument();
    s6.unmount();

    // 7. MyNotesAndHighlights in EU
    const s7 = renderWithLocale(
      <MyNotesAndHighlights curriculum="goi-teknikaria-2026" userId="u-eu" />,
      'eu',
    );
    await waitFor(() => {
      expect(screen.getByText(/ohar|nabarmendu/i)).toBeInTheDocument();
    });
    s7.unmount();
  });

  it('TestInterface isolates keyboard shortcuts (A-D, 1-4, Arrows, E) while note drawer or errata input is focused', async () => {
    const { default: TestInterface } = await loadProjectModule<TestInterfaceH2Module>(
      'src/components/TestInterface.tsx',
    );
    const questions = buildSampleQuestions(2);
    const user = userEvent.setup();

    renderWithLocale(
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

    // Answer Q1 so active study tools are unlocked
    await user.click(screen.getByText(/Un mes desde el día siguiente/i));
    expect(screen.getByText(/Ley 39\/2015, el plazo para interponer/i)).toBeInTheDocument();

    // Open note drawer and type keys that normally trigger shortcuts
    await user.click(screen.getByRole('button', { name: /nota/i }));
    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByRole('textbox');
    textarea.focus();

    const explanationVisibleBeforeNote =
      screen.queryByText(/artículo 122\.1 de la Ley 39\/2015/i) !== null;

    fireEvent.keyDown(textarea, { key: 'ArrowRight' });
    fireEvent.keyDown(textarea, { key: 'ArrowLeft' });
    fireEvent.keyDown(textarea, { key: 'e' });
    fireEvent.keyDown(textarea, { key: '2' });
    fireEvent.keyDown(textarea, { key: 'b' });

    // Must still be on Q1, explanation visibility unchanged, and dialog remains open
    expect(screen.getByText(/Ley 39\/2015, el plazo para interponer/i)).toBeInTheDocument();
    expect(screen.queryByText(/Estatuto Marco del personal estatutario/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/artículo 122\.1 de la Ley 39\/2015/i) !== null).toBe(
      explanationVisibleBeforeNote,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close note drawer and verify shortcut isolation inside the errata panel textbox
    await user.click(within(dialog).getByRole('button', { name: /cerrar|cancelar/i }));
    await user.click(screen.getByRole('button', { name: /errata|reportar/i }));
    const errataTextbox = screen.getByRole('textbox');
    errataTextbox.focus();

    const explanationVisibleBeforeErrata =
      screen.queryByText(/artículo 122\.1 de la Ley 39\/2015/i) !== null;

    fireEvent.keyDown(errataTextbox, { key: 'ArrowRight' });
    fireEvent.keyDown(errataTextbox, { key: 'ArrowLeft' });
    fireEvent.keyDown(errataTextbox, { key: 'e' });
    fireEvent.keyDown(errataTextbox, { key: '2' });
    fireEvent.keyDown(errataTextbox, { key: 'b' });

    expect(screen.getByText(/Ley 39\/2015, el plazo para interponer/i)).toBeInTheDocument();
    expect(screen.queryByText(/Estatuto Marco del personal estatutario/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/artículo 122\.1 de la Ley 39\/2015/i) !== null).toBe(
      explanationVisibleBeforeErrata,
    );
    expect(errataTextbox).toBeInTheDocument();
  });

  it('TestInterface in simulacro mode hides active-study controls (note, errata, immediate explanation) before finishing', async () => {
    const { default: TestInterface } = await loadProjectModule<TestInterfaceH2Module>(
      'src/components/TestInterface.tsx',
    );
    const questions = buildSampleQuestions(2);
    const user = userEvent.setup();

    renderWithLocale(
      <TestInterface
        questions={questions}
        mode="simulacro"
        curriculum="osakidetza-celador"
        userId="user-h2-1"
        onFinish={vi.fn()}
        onCancel={vi.fn()}
      />,
      'es',
    );

    // Answer Q1 in simulacro mode
    await user.click(screen.getByText(/Un mes desde el día siguiente/i));

    // Active-study controls and immediate explanation must NOT be exposed during simulacro
    expect(screen.queryByRole('button', { name: /nota/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /errata|reportar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/artículo 122\.1 de la Ley 39\/2015/i)).not.toBeInTheDocument();
  });

  it('questionErrataApi falls back to per-user localStorage on cloud 42P01/network failure and reads back reports', async () => {
    const { supabase } = await import('../../src/lib/supabaseClient');
    const errataApi = await loadProjectModule<QuestionErrataApiModule>(
      'src/lib/questionErrataApi.ts',
    );

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-fallback' },
        },
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    const fromSpy = vi.spyOn(supabase, 'from').mockImplementation(() => {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { code: '42P01', message: 'relation "question_errata_reports" does not exist' },
            }),
          }),
        }),
        select: () => ({
          in: () => ({
            order: async () => ({
              data: null,
              error: { code: '42P01', message: 'relation "question_errata_reports" does not exist' },
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const created = await errataApi.submitQuestionErrataReport({
      questionId: 'q-fallback-1',
      curriculum: 'osakidetza-celador',
      category: 'outdated_law',
      comment: 'Derogada parcialmente.',
      userId: 'user-fallback',
    });

    expect(fromSpy).toHaveBeenCalled();
    expect(created.source).toBe('local');
    expect(created.questionId).toBe('q-fallback-1');
    expect(created.category).toBe('outdated_law');

    const fetched = await errataApi.getUserErrataReportsForQuestions(
      ['q-fallback-1'],
      'user-fallback',
    );
    expect(fetched['q-fallback-1']).toHaveLength(1);
    expect(fetched['q-fallback-1'][0].comment).toBe('Derogada parcialmente.');
  });

  it('getStudyData deduplicates identical highlights present in both localStorage and cloud response', async () => {
    const { supabase } = await import('../../src/lib/supabaseClient');
    const quantiaApi = await loadProjectModule<QuantiaApiH2Module>('src/lib/quantiaApi.ts');

    const localData = buildSampleStudyData();
    window.localStorage.setItem('quantia_study_state', JSON.stringify(localData));

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-dedupe-1' },
        },
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    const fromSpy = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'user_highlights_v2') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    question_id: 'q-h2-1',
                    content_type: 'question',
                    answer_index: null,
                    spans: [
                      { start_index: 0, end_index: 20, type: 'law_reference' },
                      { start_index: 25, end_index: 40, type: 'core_concept' },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'user_notes') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await quantiaApi.getStudyData(['q-h2-1']);
    expect(fromSpy).toHaveBeenCalledWith('user_highlights_v2');
    const stemHighlights = result.highlights['q-h2-1'] ?? [];
    expect(stemHighlights).toHaveLength(2);
  });

  it('getQuestionsByIds handles empty array [] and chunks large batches (> 50 IDs) without dropping IDs', async () => {
    const { supabase } = await import('../../src/lib/supabaseClient');
    const questionBankApi = await loadProjectModule<QuestionBankApiH2Module>(
      'src/lib/questionBankApi.ts',
    );

    expect(await questionBankApi.getQuestionsByIds([])).toEqual({});

    const seenInChunks: string[][] = [];
    vi.spyOn(supabase, 'from').mockImplementation(() => {
      return {
        select: () => ({
          in: async (_col: string, ids: string[]) => {
            seenInChunks.push([...ids]);
            return {
              data: ids.map((id, idx) => ({
                id,
                numero: idx + 1,
                enunciado: `Enunciado ${id}`,
                opcion_a: 'A',
                opcion_b: 'B',
                opcion_c: 'C',
                opcion_d: 'D',
                respuesta_correcta: 'a',
                explicacion: `Explicación ${id}`,
                grupo: 'comun',
                categoria: 'Ley 39/2015',
              })),
              error: null,
            };
          },
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const ids = Array.from({ length: 65 }, (_, i) => `q-chunk-${i + 1}`);
    const map = await questionBankApi.getQuestionsByIds(ids);

    expect(seenInChunks.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(map)).toHaveLength(65);
    expect(map['q-chunk-1']?.id).toBe('q-chunk-1');
    expect(map['q-chunk-65']?.id).toBe('q-chunk-65');
  });
});
