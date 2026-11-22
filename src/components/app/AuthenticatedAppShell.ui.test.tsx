import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AuthenticatedAppShell from './AuthenticatedAppShell';
import type { Session } from '@supabase/supabase-js';

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
  default: () => <div>SettingsPanelMock</div>,
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
          completedAt: todayIso,
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
    loadDashboardPrimaryBundle: vi.fn().mockResolvedValue(mockPrimaryBundle),
    hydrateDashboardBundle: vi.fn().mockResolvedValue(mockPrimaryBundle),
    getRecentSessionsForHome: vi.fn().mockResolvedValue(mockPrimaryBundle.practiceState.recentSessions),
  };
});

describe('AuthenticatedAppShell (student)', () => {
  beforeEach(() => {
    window.localStorage.removeItem('quantia.curriculum.v1');
  });

  it('no muestra el boton "Dashboard" en el sidebar', () => {
    const session = {
      user: {
        email: 'student@example.com',
        id: 'user_1',
        app_metadata: {},
        user_metadata: {},
      },
    } as unknown as Session;

    render(<AuthenticatedAppShell session={session} />);

    expect(screen.getByText(/Realizar test/i)).toBeInTheDocument();
    expect(screen.queryByText(/Dashboard/i)).not.toBeInTheDocument();
  });

  it('hidrata el bundle en segundo plano al arrancar en test-selection y muestra Racha diaria sin visitar Estadísticas', async () => {
    const session = {
      user: {
        email: 'student@example.com',
        id: 'user_1',
        app_metadata: {},
        user_metadata: {},
      },
    } as unknown as Session;

    render(<AuthenticatedAppShell session={session} />);

    expect(await screen.findByText(/Racha diaria/i)).toBeInTheDocument();
    expect(screen.getByText(/1 dias/i)).toBeInTheDocument();
  });
});

