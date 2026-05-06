import type { TestSelectionStateSnapshot } from '../../components/TestSelection';
import type { ActivePracticeSession, FinishedTestPayload, SyllabusType } from '../../types';

export type ShellView =
  | 'dashboard'
  | 'study'
  | 'study-bank'
  | 'study-active'
  | 'test-selection'
  | 'test-active'
  | 'stats'
  | 'test-results'
  | 'settings'
  | 'admin-questions'
  | 'admin-dashboard'
  | 'admin-students'
  | 'admin-catalogs'
  | 'telemetry';

export type TestReturnTarget =
  | {
      view: 'dashboard';
    }
  | {
      view: 'test-selection';
      selectionState: TestSelectionStateSnapshot | null;
      selectedSyllabus: SyllabusType | null;
      selectedLawFilter: string | null;
    }
  | {
      view: 'test-results';
      session: ActivePracticeSession;
      payload: FinishedTestPayload;
      selectedSyllabus: SyllabusType | null;
      selectedLawFilter: string | null;
    };
