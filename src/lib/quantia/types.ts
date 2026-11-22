import type {
  AccountIdentity,
  CloudPracticeState,
  PracticeCategoryRiskSummary,
  PracticeSessionSummary,
} from '../../types';
import type { QuestionBlockPerformance } from '../questionBlockStats';
import type { StatsAttemptTelemetry } from '../statsInsights';

export type DashboardBundle = {
  identity: AccountIdentity;
  practiceState: CloudPracticeState;
  activitySessions: PracticeSessionSummary[];
  questionsCount: number;
  weakCategories: PracticeCategoryRiskSummary[];
  questionBlocks: QuestionBlockPerformance[];
  statsTelemetry?: StatsAttemptTelemetry | null;
  hydrationStatus?: 'primary' | 'hydrating' | 'ready' | 'error';
  telemetryError?: string | null;
};

export type CurriculumOption = {
  id: string;
  label: string;
  questionCount?: number | null;
  sessionCount?: number | null;
  answeredCount?: number | null;
  lastStudiedAt?: string | null;
};
