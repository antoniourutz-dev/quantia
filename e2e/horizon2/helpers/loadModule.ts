import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentType, ReactNode } from 'react';
import type {
  ActivePracticeSession,
  FinishedTestPayload,
  PracticeExamTarget,
  PracticeLearningDashboard,
  PracticeLearningDashboardV2,
  PracticeMode,
  PracticePressureInsights,
  PracticePressureInsightsV2,
  PracticeSessionSummary,
  Question,
  SyllabusType,
  TestResult,
} from '../../../src/types';
import type { CurriculumOption, DashboardBundle } from '../../../src/lib/quantia/types';
import type { CoachPlanV2, CoachTwoLineMessage } from '../../../src/lib/coach';
import type { CustomPracticeSupportMode } from '../../../src/domain/customPractice/customPracticeTypes';
import type { StudyQuestionData } from '../../../src/lib/quantiaApi';
import type { TopicInsightItem } from '../../../src/lib/statsInsights';
import type { HighlightType, TextHighlight } from '../../../src/components/HighlightableText';
import type { AppLocale } from '../../../src/lib/locale';
import type { ExecutableSessionPlan } from '../../../src/types';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

export async function loadProjectModule<T>(repoRelativePath: string): Promise<T> {
  const resolvedPath = path.resolve(repoRoot, repoRelativePath);
  const loaded: unknown = await import(/* @vite-ignore */ resolvedPath);
  return loaded as T;
}

// --- F1–F4: Net Score Contracts ---

export type PenaltyRuleId = 'none' | 'quarter' | 'third';

export interface PenaltyRuleMeta {
  id: PenaltyRuleId;
  factor: number;
  shortLabel: string;
  errorsPerPoint: number | null;
  breakEvenPct: number;
}

export interface NetScoreInput {
  correct: number;
  incorrect: number;
  unanswered?: number;
  total: number;
  penaltyRule: PenaltyRuleId;
}

export interface NetScoreResult {
  penaltyRule: PenaltyRuleId;
  penaltyFactor: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  rawAccuracyPct: number;
  rawNetPoints: number;
  clampedNetPoints: number;
  rawScoreBase10: number;
  scoreBase10: number;
  netPct: number;
  penaltyLostPoints: number;
  penaltyLostBase10: number;
}

export interface NetScoreSimulationInput {
  examQuestions: number;
  accuracyRate: number;
  answerRate: number;
  penaltyRule: PenaltyRuleId;
  targetScoreBase10: number;
}

export interface NetScoreSimulationResult {
  examQuestions: number;
  answeredCount: number;
  blankCount: number;
  expectedCorrect: number;
  expectedIncorrect: number;
  rawNetPoints: number;
  scoreBase10: number;
  targetScoreBase10: number;
  gapBase10: number;
  meetsTarget: boolean;
  penaltyLostBase10: number;
  requiredAccuracyPct: number | null;
  byRule: Record<PenaltyRuleId, { scoreBase10: number; meetsTarget: boolean }>;
}

export interface TopicRoiItem {
  id: string;
  label: string;
  scope: SyllabusType;
  questionCount: number;
  weightPct: number;
  coveragePct: number;
  currentAccuracyPct: number | null;
  fragileCount: number;
  unseenCount: number;
  potentialBase10Gain: number;
  effortScore: number;
  roiScore: number;
  reason: 'high_error_weight' | 'unexplored_weight' | 'fragile_cleanup';
}

export interface NetScoreModule {
  DEFAULT_PENALTY_RULE: PenaltyRuleId;
  PENALTY_RULE_ORDER: PenaltyRuleId[];
  PENALTY_RULES: Record<PenaltyRuleId, PenaltyRuleMeta>;
  isPenaltyRuleId: (value: unknown) => value is PenaltyRuleId;
  readPenaltyRule: (userId: string) => PenaltyRuleId;
  writePenaltyRule: (userId: string, rule: PenaltyRuleId) => void;
  formatNetScore: (value: number, decimals?: number) => string;
  calculateNetScore: (input: NetScoreInput) => NetScoreResult;
  simulateExamNetScore: (input: NetScoreSimulationInput) => NetScoreSimulationResult;
  buildTopicRoiPriorities: (params: {
    topics: TopicInsightItem[];
    penaltyRule: PenaltyRuleId;
    targetAccuracyRate?: number;
    limit?: number;
  }) => TopicRoiItem[];
}

export interface SettingsPanelH2Props {
  examTarget: PracticeExamTarget | null;
  saving: boolean;
  notice: { kind: 'success' | 'error'; text: string } | null;
  curriculumOptions: CurriculumOption[];
  visibleCurriculumIds: string[];
  visiblePracticeModeIds: string[];
  customSupportMode: CustomPracticeSupportMode;
  penaltyRule: PenaltyRuleId;
  onSave: (next: {
    examDate: string | null;
    dailyReviewCapacity: number;
    dailyNewCapacity: number;
    visibleCurriculumIds: string[];
    visiblePracticeModeIds: string[];
    customSupportMode: CustomPracticeSupportMode;
    penaltyRule: PenaltyRuleId;
  }) => Promise<void>;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onOpenTelemetry?: () => void;
}

export interface SettingsPanelH2Module {
  default: ComponentType<SettingsPanelH2Props>;
}

export interface PostTestStatsH2Props {
  payload: FinishedTestPayload;
  topicReview?: ReactNode;
  questions: Question[];
  mode: PracticeMode;
  curriculum: string;
  username?: string | null;
  coachContext?: ActivePracticeSession['coach'] | null;
  penaltyRule?: PenaltyRuleId;
  userId?: string | null;
  onStartNextSession?: (params: {
    mode: PracticeMode;
    questionCount: number | null;
    syllabus: SyllabusType | null;
  }) => void;
  onRestart: () => void;
  onGoBack: () => void;
  onGoHome: () => void;
  homeVariant?: 'dashboard' | 'test-selection';
}

export interface PostTestStatsH2Module {
  default: ComponentType<PostTestStatsH2Props>;
}

export interface NetScoreSimulatorCardProps {
  penaltyRule: PenaltyRuleId;
  onChangePenaltyRule?: (rule: PenaltyRuleId) => void;
  readinessPct: number;
  observedAccuracyPct: number;
  topicInsights: TopicInsightItem[];
  lawBreakdown: Array<{
    ley_referencia: string;
    attempts: number;
    correctAttempts: number;
    accuracyRate: number;
    questionCount?: number;
    consolidatedCount?: number;
  }>;
  singleScope: boolean;
  lawCurriculum: boolean;
  onPracticeTopic?: (topicLabel: string, scope: SyllabusType) => void;
  onPracticeLaw?: (lawReference: string) => void;
}

export interface NetScoreSimulatorCardModule {
  default: ComponentType<NetScoreSimulatorCardProps>;
}

export interface StatsDashboardH2Props {
  results: TestResult[];
  bundle: DashboardBundle | null;
  curriculum: string;
  coachPlan?: CoachPlanV2 | null;
  executablePlan?: ExecutableSessionPlan | null;
  hydrating?: boolean;
  telemetryError?: string | null;
  penaltyRule?: PenaltyRuleId;
  onChangePenaltyRule?: (rule: PenaltyRuleId) => void;
  onRetryTelemetry?: () => void;
  onStartRecommended?: () => void;
  onPracticeTopic?: (topicLabel: string, scope: SyllabusType) => void;
  onPracticeBlock?: (start: number, end: number, scope: SyllabusType) => void;
  onPracticeReviewMistakes?: () => void;
  onPracticeMixed?: () => void;
  onPracticeLaw?: (lawReference: string) => void;
}

export interface StatsDashboardH2Module {
  default: ComponentType<StatsDashboardH2Props>;
}

// --- F7–F10: Entry, Coach Strip & Practice Selection Contracts ---

export interface TodayPlanStripProps {
  streakDays: number;
  hydrated: boolean;
  disabled?: boolean;
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  sessionMetaLabel?: string | null;
  ctaLabel: string;
  tone?: 'rescue' | 'protect' | 'build' | 'push' | 'maintain';
  onStartPlan: () => void;
}

export interface TodayPlanStripModule {
  default: ComponentType<TodayPlanStripProps>;
}

export interface PracticeModeVisibilityH2Module {
  PRACTICE_MODE_IDS: readonly string[];
  normalizePracticeModeIds: (values: unknown) => string[];
  readVisiblePracticeModeIds: (userId: string) => string[];
  writeVisiblePracticeModeIds: (userId: string, practiceModeIds: string[]) => void;
}

export interface CoachH2Module {
  buildCoachPlanV2: (input: {
    learningDashboard: PracticeLearningDashboard | null;
    learningDashboardV2?: PracticeLearningDashboardV2 | null;
    pressureInsights: PracticePressureInsights | null;
    pressureInsightsV2?: PracticePressureInsightsV2 | null;
    examTarget: PracticeExamTarget | null;
    recentSessions: PracticeSessionSummary[];
    recommendedBatchNumber: number;
    totalBatches: number;
    batchSize: number;
    locale?: AppLocale;
  }) => CoachPlanV2;
  buildCoachTwoLineMessageV2: (
    plan: CoachPlanV2,
    options?: {
      contextLabel?: string;
      locale?: AppLocale;
    },
  ) => CoachTwoLineMessage;
}

export interface TestSelectionH2Props {
  curriculum: string;
  lawOptions: string[];
  lawOptionsLoading?: boolean;
  initialLaw?: string | null;
  onStart: (
    mode: PracticeMode,
    syllabus?: SyllabusType,
    count?: number,
    coachContext?: ActivePracticeSession['coach'] | null,
    reviewPeriod?:
      | { type: 'all' }
      | { type: 'recent_tests'; count: number }
      | { type: 'last_day' },
  ) => void;
  onStartLawTest: (law: string, count?: number) => void;
  onStartCustomTest: (params: {
    from: number;
    to: number;
    randomize: boolean;
    syllabus?: SyllabusType | null;
  }) => void;
  onStartCustomPractice: (config: {
    contentScope: string;
    topicMode: 'all' | 'single';
    topic: string;
    sessionLength: number;
    order: 'sequence' | 'random';
    showMarks: boolean;
    showNotes: boolean;
  }) => void;
  initialSyllabus: SyllabusType | null;
  visiblePracticeModeIds?: string[];
  customSupportMode?: CustomPracticeSupportMode;
  userId?: string | null;
}

export interface TestSelectionH2Module {
  default: ComponentType<TestSelectionH2Props>;
}

// --- F12–F17: Active Study, Errata & Library Contracts ---

export interface UserStudyLibraryData {
  highlights: Record<string, TextHighlight[]>;
  notes: Record<string, string>;
  questionIds?: string[];
}

export interface QuantiaApiH2Module {
  getStudyData: (questionIds: string[]) => Promise<StudyQuestionData>;
  addStudyHighlight: (
    questionId: string,
    highlight: Omit<TextHighlight, 'id'>,
  ) => Promise<TextHighlight>;
  removeStudyHighlight: (questionId: string, highlightId: string) => Promise<void>;
  saveStudyNote: (questionId: string, note: string) => Promise<void>;
  getAllUserStudyData: () => Promise<UserStudyLibraryData>;
}

export interface QuestionBankApiH2Module {
  getQuestionsByIds: (questionIds: string[]) => Promise<Record<string, Question>>;
}

export interface UseStudyAnnotationsParams {
  questionIds: string[];
  initialData?: StudyQuestionData | null;
  enabled?: boolean;
}

export interface UseStudyAnnotationsResult {
  highlightsMap: Record<string, TextHighlight[]>;
  notesMap: Record<string, string>;
  loading: boolean;
  addHighlight: (key: string, startIndex: number, endIndex: number, type: HighlightType) => Promise<void>;
  removeHighlight: (key: string, highlightId: string) => Promise<void>;
  saveNote: (questionId: string, note: string) => Promise<void>;
}

export interface UseStudyAnnotationsModule {
  useStudyAnnotations: (params: UseStudyAnnotationsParams) => UseStudyAnnotationsResult;
}

export interface QuestionNoteDrawerProps {
  open: boolean;
  questionId: string;
  questionNumber?: number | null;
  note: string;
  onSave: (note: string) => Promise<void> | void;
  onClose: () => void;
}

export interface QuestionNoteDrawerModule {
  default: ComponentType<QuestionNoteDrawerProps>;
}

export type ErrataCategory =
  | 'wrong_answer'
  | 'outdated_law'
  | 'ambiguous_wording'
  | 'typo'
  | 'bad_explanation';

export interface QuestionErrataReport {
  id: string;
  questionId: string;
  curriculum: string;
  category: ErrataCategory;
  comment: string | null;
  createdAt: string;
  source?: 'cloud' | 'local';
}

export interface SubmitErrataReportInput {
  questionId: string;
  curriculum: string;
  category: ErrataCategory;
  comment?: string | null;
  userId?: string | null;
}

export interface QuestionErrataApiModule {
  submitQuestionErrataReport: (input: SubmitErrataReportInput) => Promise<QuestionErrataReport>;
  getUserErrataReportsForQuestions: (
    questionIds: string[],
    userId?: string | null,
  ) => Promise<Record<string, QuestionErrataReport[]>>;
}

export interface QuestionErrataPanelProps {
  open: boolean;
  questionId: string;
  curriculum: string;
  userId?: string | null;
  existingReports?: QuestionErrataReport[];
  onSubmitted?: (report: QuestionErrataReport) => void;
  onClose: () => void;
}

export interface QuestionErrataPanelModule {
  default: ComponentType<QuestionErrataPanelProps>;
}

export interface TestInterfaceH2Props {
  questions: Question[];
  mode: PracticeMode;
  curriculum?: string;
  userId?: string | null;
  supportMode?: { showMarks: boolean; showNotes: boolean } | null;
  studyData?: StudyQuestionData | null;
  allowInSessionMistakeReview?: boolean;
  onFinish: (payload: FinishedTestPayload) => void | Promise<void>;
  onCancel: () => void;
  isFinishing?: boolean;
  activityContext?: { userId: string; curriculum: string; sessionId: string } | null;
}

export interface TestInterfaceH2Module {
  default: ComponentType<TestInterfaceH2Props>;
}

export type StudySubNavTab = 'study-bank' | 'study' | 'study-notes';

export interface StudySubNavProps {
  activeView: StudySubNavTab;
  onSelectView: (view: StudySubNavTab) => void;
  notesCount?: number;
}

export interface StudySubNavModule {
  default: ComponentType<StudySubNavProps>;
}

export interface MyNotesAndHighlightsProps {
  curriculum: string;
  userId?: string | null;
  onJumpToQuestion?: (questionId: string) => void;
  onOpenStudyBank?: () => void;
}

export interface MyNotesAndHighlightsModule {
  default: ComponentType<MyNotesAndHighlightsProps>;
}
