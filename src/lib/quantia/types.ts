import type {
  AccountIdentity,
  CloudPracticeState,
  PracticeCategoryRiskSummary,
  PracticeSessionSummary,
} from '../../types';
import type { QuestionBlockPerformance } from '../questionBlockStats';

export type DashboardBundle = {
  identity: AccountIdentity;
  practiceState: CloudPracticeState;
  activitySessions: PracticeSessionSummary[];
  questionsCount: number;
  weakCategories: PracticeCategoryRiskSummary[];
  questionBlocks: QuestionBlockPerformance[];
};

export type CurriculumOption = {
  id: string;
  label: string;
  questionCount?: number | null;
  sessionCount?: number | null;
  answeredCount?: number | null;
  lastStudiedAt?: string | null;
};
