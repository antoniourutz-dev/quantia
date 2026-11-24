import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AuthenticatedAppShell from './AuthenticatedAppShell';
import type { Session } from '@supabase/supabase-js';
import type { PenaltyRuleId } from '../../lib/netScore';

const getRandomPracticeBatchMock = vi.fn();
const loadDashboardPrimaryBundleMock = vi.fn();
const settingsPanelSpy = vi.fn();

vi.mock('../TestSelection', () => ({
  default: () => <div>TestSelectionMock</div>,
}));
vi.mock('../TestInterface', () => ({
  default: () => <div>TestInterfaceMock</div>,
}));
vi.mock('../StudyExplorer', () => ({
  default: () => <div>StudyExplorerMock</div>,
}));
vi.mock('../StudyInterface', () => ({
  default: () => <div>StudyInterfaceMock</div>,
}));
vi.mock('../PostTestStats', () => ({
  default: () => <div>PostTestStatsMock</div>,
}));
vi.mock('../SettingsPanel', () => ({
  default: (props: { penaltyRule: PenaltyRuleId }) => {
    settingsPanelSpy(props);
    return <div data-testid="settings-panel-mock">SettingsPanelMock:{props.penaltyRule}</div>;
  },
}));
vi.mock('../StatsDashboard', () => ({
  default: () => <div>StatsDashboardMock</div>,
}));
vi.mock('../StudyQuestionBank', () => ({
  default: () => <div>StudyQuestionBankMock</div>,
}));
vi.mock('../TelemetryDebugPanel', () => ({
  default: () => <div>TelemetryDebugPanelMock</div>,
}));

vi.mock('../../lib/quantiaApi', async () => {
  const actual = await vi.importActual<typeof import('../../lib/quantiaApi')>(
    '../../lib/quantiaApi',
  );
  const todayIso = new Date().toISOString();
  const mockPrimaryBundle = {
    identity: {
      is_admin: false,
    },
    questionsCount: 100,
    questionBlocks: [],
    weakCategories: [],
    practiceState: {
      recentSessions: [
        {
          id: 'sess-1',
          startedAt: todayIso,
          finishedAt: todayIso,
          score: 8,
          total: 10,
          mode: 'standard',
          title: 'Práctica',
          syllabus: 'common',
        },
      ],
      learningDashboardV2: null,
    },
  };
  return {
    ...actual,
    getAvailableCurriculums: vi.fn().mockResolvedValue(
      actual.buildFallbackCurriculumOptions(actual.DEFAULT_CURRICULUM),
    ),
    getQuantiaManagementPermissions: vi.fn().mockResolvedValue({
      permissions: {},
      isOwner: false,
    }),
    loadDashboardPrimaryBundle: (...args: unknown[]) => {
      loadDashboardPrimaryBundleMock(...args);
      return Promise.resolve(mockPrimaryBundle);
    },
    hydrateDashboardBundle: vi.fn().mockResolvedValue(mockPrimaryBundle),
    getRecentSessionsForHome: vi.fn().mockResolvedValue(mockPrimaryBundle.practiceState.recentSessions),
    getRandomPracticeBatch: (...args: unknown[]) => getRandomPracticeBatchMock(...args),
  };
});

const createStudentSession = (): Session =>
  ({
    user: {
      email: 'student@example.com',
      id: 'user_1',
      app_metadata: {},
      user_metadata: {},
    },
  }) as unknown as Session;

describe('AuthenticatedAppShell (student)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getRandomPracticeBatchMock.mockReset();
    loadDashboardPrimaryBundleMock.mockReset();
    settingsPanelSpy.mockReset();
    getRandomPracticeBatchMock.mockResolvedValue([
      {
        id: 'q1',
        question: 'Pregunta de prueba',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        explanation: 'Explicación',
        category: 'Tema 1',
        syllabus: 'common',
      },
    ]);
  });

  it('no muestra el boton "Dashboard" en el sidebar', () => {
    render(<AuthenticatedAppShell session={createStudentSession()} />);

    expect(screen.getByText(/Realizar test/i)).toBeInTheDocument();
    expect(screen.queryByText(/Dashboard/i)).not.toBeInTheDocument();
  });

  it('hidrata el bundle en segundo plano al arrancar en test-selection y muestra Racha diaria + TodayPlanStrip', async () => {
    render(<AuthenticatedAppShell session={createStudentSession()} />);

    expect(await screen.findByText(/Racha diaria/i)).toBeInTheDocument();
    expect(screen.getByText(/1 días/i)).toBeInTheDocument();

    const strip = await screen.findByTestId('today-plan-strip');
    expect(strip).toBeInTheDocument();
    expect(screen.getByText('Tu plan de hoy')).toBeInTheDocument();
    expect(screen.getByTestId('today-plan-streak')).toHaveTextContent('1 día');
  });

  it('lanza la sesión recomendada del Coach en 1 clic desde TodayPlanStrip', async () => {
    render(<AuthenticatedAppShell session={createStudentSession()} />);

    const strip = await screen.findByTestId('today-plan-strip');
    await waitFor(() => {
      expect(strip).toHaveAttribute('data-hydrated', 'true');
    });

    const ctaButton = strip.querySelector('button');
    expect(ctaButton).not.toBeNull();
    fireEvent.click(ctaButton!);

    expect(await screen.findByText('TestInterfaceMock')).toBeInTheDocument();
    expect(getRandomPracticeBatchMock).toHaveBeenCalled();
  });

  it('no vuelve a hidratar redundantemente al cambiar entre test-selection y settings y preserva penaltyRule', async () => {
    window.localStorage.setItem('quantia.penalty-rule.v1:user_1', 'third');

    render(<AuthenticatedAppShell session={createStudentSession()} />);

    await screen.findByTestId('today-plan-strip');
    await waitFor(() => {
      expect(loadDashboardPrimaryBundleMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Ajustes/i }));
    expect(await screen.findByTestId('settings-panel-mock')).toHaveTextContent('SettingsPanelMock:third');

    fireEvent.click(screen.getByRole('button', { name: /Realizar test/i }));
    await screen.findByTestId('today-plan-strip');

    expect(loadDashboardPrimaryBundleMock).toHaveBeenCalledTimes(1);
  });
});
