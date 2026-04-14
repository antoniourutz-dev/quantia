export type OptionKey = 'a' | 'b' | 'c' | 'd';
export type SyllabusType = 'common' | 'specific';
export type PracticeQuestionScope = SyllabusType;
export type PracticeQuestionScopeFilter = 'all' | PracticeQuestionScope;
export type PracticeMode =
  | 'standard'
  | 'quick_five'
  | 'weakest'
  | 'random'
  | 'review'
  | 'mixed'
  | 'simulacro'
  | 'anti_trap'
  | 'custom';

import type { AppLocale } from './lib/locale';

export interface Option {
  id: OptionKey;
  text: string;
}

export interface Question {
  id: string;
  number: number | null;
  text: string;
  options: Option[];
  correctAnswer: OptionKey;
  explanation: string;
  syllabus: SyllabusType;
  category: string | null;
  questionScope: PracticeQuestionScope | null;
}

export interface TestAnswer {
  questionId: string;
  selectedOption: OptionKey | null;
  correctOption: OptionKey;
  isCorrect: boolean;
  answeredAt: string;
  responseTimeMs: number | null;
  timeToFirstSelectionMs: number | null;
  changedAnswer: boolean;
}

export interface FinishedTestPayload {
  score: number;
  answers: TestAnswer[];
}

export interface TestResult {
  id: string;
  date: string;
  score: number;
  total: number;
  mode: PracticeMode;
  label: string;
}

export interface AccountIdentity {
  user_id: string;
  current_username: string;
  is_admin: boolean;
  player_mode: 'advanced' | 'generic';
  previous_usernames: string[];
  xp?: number;
  streak?: number;
  level?: number;
}

export interface PracticeSessionSummary {
  id: string;
  mode: PracticeMode;
  title: string;
  startedAt: string;
  finishedAt: string;
  score: number;
  total: number;
}

export type PracticeConfidenceFlag = 'low' | 'medium' | 'high';

export interface PracticeLearningDashboard {
  totalQuestions: number;
  seenQuestions: number;
  readiness: number;
  overdueCount: number;
  dailyReviewCapacity: number;
  dailyNewCapacity: number;
  examDate: string | null;
  focusMessage: string;
}

export interface PracticeLawBlockPerformance {
  blockId: string;
  title: string;
  trainingFocus?: string | null;
  questionCount?: number;
  consolidatedCount?: number;
  attempts: number;
  correctAttempts: number;
  accuracyRate: number;
}

export interface PracticeLawPerformance {
  ley_referencia: string;
  lawId?: string;
  shortTitle?: string | null;
  trainingIntent?: string | null;
  blocks?: PracticeLawBlockPerformance[];
  scope?: 'common' | 'specific' | 'unknown';
  attempts: number;
  questionCount?: number;
  consolidatedCount?: number;
  correctAttempts: number;
  accuracyRate: number;
}

export interface PracticeTopicPerformance {
  topicLabel: string;
  scope?: 'common' | 'specific' | 'unknown';
  attempts: number;
  questionCount?: number;
  consolidatedCount?: number;
  unseenCount?: number;
  fragileCount?: number;
  consolidatingCount?: number;
  solidCount?: number;
  masteredCount?: number;
  correctAttempts: number;
  accuracyRate: number;
}

export interface PracticeLearningDashboardV2 {
  totalQuestions: number;
  seenQuestions: number;
  coverageRate: number;
  observedAccuracyRate: number;
  observedAccuracyN: number;
  observedAccuracyCiLow: number | null;
  observedAccuracyCiHigh: number | null;
  observedAccuracySampleOk: boolean;
  retentionSeenRate: number | null;
  retentionSeenN: number;
  retentionSeenConfidenceFlag: PracticeConfidenceFlag;
  unseenPriorRate: number;
  examReadinessRate: number;
  examReadinessCiLow: number | null;
  examReadinessCiHigh: number | null;
  examReadinessConfidenceFlag: PracticeConfidenceFlag;
  backlogOverdueCount: number;
  fragileCount: number;
  consolidatingCount: number;
  solidCount: number;
  masteredCount: number;
  recommendedReviewCount: number;
  recommendedNewCount: number;
  recommendedTodayCount: number;
  recommendedMode: PracticeMode;
  focusMessage: string;
  lawBreakdown?: PracticeLawPerformance[];
  topicBreakdown?: PracticeTopicPerformance[];
}

export interface PracticePressureInsights {
  learningAccuracy: number | null;
  simulacroAccuracy: number | null;
  pressureGap: number | null;
  avgSimulacroFatigue: number | null;
  overconfidenceRate: number | null;
  recommendedMode: PracticeMode | null;
  pressureMessage: string;
}

export interface PracticePressureInsightsV2 {
  learningAccuracy: number | null;
  simulacroAccuracy: number | null;
  pressureGapRaw: number | null;
  learningSessionN: number;
  simulacroSessionN: number;
  learningQuestionN: number;
  simulacroQuestionN: number;
  avgSimulacroFatigue: number | null;
  overconfidenceRate: number | null;
  sampleOk: boolean;
  confidenceFlag: PracticeConfidenceFlag;
  recommendedMode: PracticeMode | null;
  pressureMessage: string;
}

export interface PracticeExamTarget {
  userId: string;
  curriculum: string;
  examDate: string | null;
  dailyReviewCapacity: number;
  dailyNewCapacity: number;
  updatedAt: string | null;
}

export interface PracticeCategoryRiskSummary {
  category: string;
  attempts: number;
  incorrectAttempts: number;
  rawFailRate: number | null;
  smoothedFailRate: number | null;
  baselineFailRate: number | null;
  excessRisk: number | null;
  sampleOk: boolean;
  confidenceFlag: PracticeConfidenceFlag;
}

export interface CloudPracticeState {
  recentSessions: PracticeSessionSummary[];
  learningDashboard: PracticeLearningDashboard | null;
  learningDashboardV2: PracticeLearningDashboardV2 | null;
  examTarget: PracticeExamTarget | null;
  pressureInsights: PracticePressureInsights | null;
  pressureInsightsV2: PracticePressureInsightsV2 | null;
}

export interface ActivePracticeSession {
  id: string;
  mode: PracticeMode;
  title: string;
  startedAt: string;
  questions: Question[];
  batchNumber: number;
  totalBatches: number;
  batchStartIndex: number | null;
  nextStandardBatchStartIndex: number | null;
}

export const formatSyllabusLabel = (syllabus: SyllabusType, locale: AppLocale = 'es') => {
  if (locale === 'eu') {
    return syllabus === 'common' ? 'Orokorra' : 'Espezifikoa';
  }
  return syllabus === 'common' ? 'Comun' : 'Especifico';
};

export const formatModeLabel = (mode: PracticeMode, locale: AppLocale = 'es') => {
  switch (mode) {
    case 'mixed':
      return locale === 'eu' ? 'Egokitzailea' : 'Adaptativo';
    case 'simulacro':
      return locale === 'eu' ? 'Simulakroa' : 'Simulacro';
    case 'anti_trap':
      return locale === 'eu' ? 'Tranpa-kontra' : 'Anti-trampas';
    case 'custom':
      return locale === 'eu' ? 'Pertsonalizatua' : 'Personalizado';
    case 'quick_five':
      return locale === 'eu' ? 'Azkarra' : 'Rapida';
    case 'weakest':
      return locale === 'eu' ? 'Errepasoa' : 'Repaso';
    case 'review':
      return locale === 'eu' ? 'Berrikuspena' : 'Revision';
    case 'random':
      return locale === 'eu' ? 'Ausazkoa' : 'Aleatorio';
    default:
      return locale === 'eu' ? 'Blokea' : 'Bloque';
  }
};
