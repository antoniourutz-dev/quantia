import type {
  AccountIdentity,
  CloudPracticeState,
  PracticeCategoryRiskSummary,
  PracticeSessionSummary,
} from '../../types';

export type DashboardBundle = {
  identity: AccountIdentity;
  practiceState: CloudPracticeState;
  activitySessions: PracticeSessionSummary[];
  questionsCount: number;
  weakCategories: PracticeCategoryRiskSummary[];
};

export type CurriculumOption = {
  id: string;
  label: string;
  questionCount?: number | null;
  sessionCount?: number | null;
  answeredCount?: number | null;
  lastStudiedAt?: string | null;
};
