import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import {
  loadProjectModule,
  type MyNotesAndHighlightsModule,
  type NetScoreModule,
  type PenaltyRuleId,
  type PostTestStatsH2Module,
  type QuantiaApiH2Module,
  type SettingsPanelH2Module,
  type StatsDashboardH2Module,
  type StudySubNavModule,
  type StudySubNavTab,
  type TestInterfaceH2Module,
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

describe('Horizonte 2 — Tier 3: Cross-Feature Combinations', () => {
  beforeEach(() => {
    resetE2EEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SettingsPanel penalty rule (none -> third) persists via netScore.ts and drives PostTestStats + StatsDashboard live switching', async () => {
    const netScore = await loadProjectModule<NetScoreModule>('src/lib/netScore.ts');
    const { default: SettingsPanel } = await loadProjectModule<SettingsPanelH2Module>(
      'src/components/SettingsPanel.tsx',
    );
    const { default: PostTestStats } = await loadProjectModule<PostTestStatsH2Module>(
      'src/components/PostTestStats.tsx',
    );
    const { default: StatsDashboard } = await loadProjectModule<StatsDashboardH2Module>(
      'src/components/StatsDashboard.tsx',
    );

    const userId = 'user-cross-1';
    const user = userEvent.setup();

    let savedRule: PenaltyRuleId = netScore.readPenaltyRule(userId);
    expect(savedRule).toBe('none');

    const settingsRender = renderWithLocale(
      <SettingsPanel
        examTarget={buildSampleExamTarget({ userId })}
        saving={false}
        notice={null}
        curriculumOptions={buildSampleCurriculumOptions()}
        visibleCurriculumIds={['osakidetza-celador']}
        visiblePracticeModeIds={['standard', 'errors', 'topics', 'simulacro', 'challenge', 'custom']}
        customSupportMode={{ showMarks: true, showNotes: true }}
        penaltyRule={savedRule}
        onSave={async (next) => {
          netScore.writePenaltyRule(userId, next.penaltyRule);
          savedRule = netScore.readPenaltyRule(userId);
        }}
      />,
      'es',
    );

    const penaltyGroup = screen.getByRole('radiogroup', { name: /penaliz/i });
    await user.click(within(penaltyGroup).getByRole('radio', { name: /-0,33/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(savedRule).toBe('third');
    });
    expect(netScore.readPenaltyRule(userId)).toBe('third');
    settingsRender.unmount();

    // Feed persisted rule into PostTestStats (3 correct, 1 incorrect out of 4 -> (3 - 1/3)/4 * 10 = 6,67)
    const questions = buildSampleQuestions(4);
    const payload = buildFinishedTestPayload(questions, [
      'correct',
      'correct',
      'correct',
      'incorrect',
    ]);

    const postTestRender = renderWithLocale(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        penaltyRule={savedRule}
        onRestart={vi.fn()}
        onGoBack={vi.fn()}
        onGoHome={vi.fn()}
      />,
      'es',
    );

    expect(screen.getAllByText(/6,67/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-0,33/).length).toBeGreaterThan(0);
    postTestRender.unmount();

    // Feed persisted rule into StatsDashboard & verify live switching updates persisted rule
    const onChangePenaltyRule = vi.fn((nextRule: PenaltyRuleId) => {
      netScore.writePenaltyRule(userId, nextRule);
    });

    renderWithLocale(
      <StatsDashboard
        results={buildSampleTestResults()}
        bundle={buildSampleDashboardBundle()}
        curriculum="osakidetza-celador"
        penaltyRule={savedRule}
        onChangePenaltyRule={onChangePenaltyRule}
      />,
      'es',
    );

    const quarterBtn = screen.getAllByRole('button', { name: /-0,25/i })[0];
    await user.click(quarterBtn);
    expect(onChangePenaltyRule).toHaveBeenCalledWith('quarter');
    expect(netScore.readPenaltyRule(userId)).toBe('quarter');
  });

  it('TodayPlanStrip 1-click Coach launch flows into TestInterface with active study (highlight + note + errata) and completes test cleanly', async () => {
    const { default: TodayPlanStrip } = await loadProjectModule<TodayPlanStripModule>(
      'src/components/TodayPlanStrip.tsx',
    );
    const { default: TestInterface } = await loadProjectModule<TestInterfaceH2Module>(
      'src/components/TestInterface.tsx',
    );

    const user = userEvent.setup();
    let sessionStarted = false;

    const stripRender = renderWithLocale(
      <TodayPlanStrip
        streakDays={5}
        hydrated={true}
        eyebrow="Tu plan de hoy"
        title="Repasa fallos críticos"
        sessionMetaLabel="2 preg. · ~2 min"
        ctaLabel="Empezar sesión"
        onStartPlan={() => {
          sessionStarted = true;
        }}
      />,
      'es',
    );

    await user.click(screen.getByRole('button', { name: /empezar sesión/i }));
    expect(sessionStarted).toBe(true);
    stripRender.unmount();

    const questions = buildSampleQuestions(2);
    const onFinish = vi.fn();

    const { container } = renderWithLocale(
      <TestInterface
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        userId="user-cross-2"
        onFinish={onFinish}
        onCancel={vi.fn()}
      />,
      'es',
    );

    // Answer Q1
    await user.click(screen.getByText(/Un mes desde el día siguiente/i));

    // Active highlight on Q1
    const highlightable = container.querySelector('.highlightable-text');
    expect(highlightable).toBeTruthy();
    if (highlightable) {
      simulateTextSelection(highlightable, 0, 12);
      const keyHighlightBtn = screen.getByRole('button', {
        name: /concepto clave|funtsezko kontzeptua|clave|gakoa/i,
      });
      await user.click(keyHighlightBtn);
    }

    // Active note on Q1
    await user.click(screen.getByRole('button', { name: /nota/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Nota en revisión durante test');
    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    // Active errata panel check on Q1
    await user.click(screen.getByRole('button', { name: /errata|reportar/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cerrar|cancelar/i }));

    // Navigate to Q2, answer, and finish test
    const nextBtn = screen.getAllByRole('button', {
      name: /^(siguiente|hurrengoa|hurrengo galdera)$/i,
    })[0];
    await user.click(nextBtn);
    // The stem also contains "a los cuatro años": target the option button explicitly.
    await user.click(screen.getByRole('button', { name: /A los cuatro años/i }));

    const finishBtn = screen.getAllByRole('button', {
      name: /^(finalizar( test)?|amaitu( test)?)$/i,
    })[0];
    await user.click(finishBtn);

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledTimes(1);
    });
    expect(onFinish.mock.calls[0][0].score).toBe(2);
  });

  it('PostTestStats review highlight & note persist to quantia_study_state / getAllUserStudyData and appear in MyNotesAndHighlights', async () => {
    const quantiaApi = await loadProjectModule<QuantiaApiH2Module>('src/lib/quantiaApi.ts');
    const { default: PostTestStats } = await loadProjectModule<PostTestStatsH2Module>(
      'src/components/PostTestStats.tsx',
    );
    const { default: MyNotesAndHighlights } = await loadProjectModule<MyNotesAndHighlightsModule>(
      'src/components/MyNotesAndHighlights.tsx',
    );

    const questions = buildSampleQuestions(2);
    const payload = buildFinishedTestPayload(questions, ['correct', 'incorrect']);
    const user = userEvent.setup();

    const postRender = renderWithLocale(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="osakidetza-celador"
        userId="user-cross-3"
        penaltyRule="quarter"
        onRestart={vi.fn()}
        onGoBack={vi.fn()}
        onGoHome={vi.fn()}
      />,
      'es',
    );

    const reviewToggle = screen.getByRole('button', {
      name: /analizar \d+ fallos?|revisar \d+ en blanco|revisar test|akatsak aztertu|zuriak berrikusi|testa berrikusi/i,
    });
    await user.click(reviewToggle);

    const highlightables = postRender.container.querySelectorAll('.highlightable-text');
    expect(highlightables.length).toBeGreaterThan(0);
    simulateTextSelection(highlightables[0], 0, 14);
    const keyHighlightBtn = screen.getByRole('button', {
      name: /concepto clave|funtsezko kontzeptua|clave|gakoa/i,
    });
    await user.click(keyHighlightBtn);

    const noteButtons = screen.getAllByRole('button', { name: /nota/i });
    await user.click(noteButtons[0]);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Repasar artículo 122.1 antes del examen');
    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(async () => {
      const library = await quantiaApi.getAllUserStudyData();
      expect(Object.values(library.notes).some((n) => n.includes('artículo 122.1'))).toBe(true);
    });

    postRender.unmount();

    renderWithLocale(
      <MyNotesAndHighlights curriculum="osakidetza-celador" userId="user-cross-3" />,
      'es',
    );

    await waitFor(() => {
      expect(screen.getByText(/Repasar artículo 122\.1 antes del examen/i)).toBeInTheDocument();
    });
  });

  it('StudySubNav switches cleanly across study-bank, study, and study-notes tabs', async () => {
    const { default: StudySubNav } = await loadProjectModule<StudySubNavModule>(
      'src/components/StudySubNav.tsx',
    );
    const user = userEvent.setup();
    const visited: StudySubNavTab[] = [];
    let currentView: StudySubNavTab = 'study-bank';

    const { rerender } = renderWithLocale(
      <StudySubNav
        activeView={currentView}
        onSelectView={(next) => {
          currentView = next;
          visited.push(next);
        }}
        notesCount={3}
      />,
      'es',
    );

    const tabs = screen.getAllByRole('button');
    expect(tabs.length).toBeGreaterThanOrEqual(3);

    for (const tab of tabs) {
      await user.click(tab);
      rerender(
        <StudySubNav
          activeView={currentView}
          onSelectView={(next) => {
            currentView = next;
            visited.push(next);
          }}
          notesCount={3}
        />,
      );
    }

    expect(new Set(visited)).toEqual(new Set(['study-bank', 'study', 'study-notes']));
  });
});
