import type { PracticeMode, SyllabusType } from '../../types';

export type CustomPracticeContentScope =
  | 'all_opposition'
  | 'common_only'
  | 'specific_only'
  | 'common_and_specific';

export type CustomPracticeTopicMode =
  | { type: 'all_topics' }
  | { type: 'single_topic'; topicId: string };

export type CustomPracticeSupportMode = {
  showMarks: boolean;
  showNotes: boolean;
};

export type CustomPracticeConfig = {
  curriculum: string;
  contentScope: CustomPracticeContentScope;
  topicMode: CustomPracticeTopicMode;
  sessionLength: number;
  supportMode: CustomPracticeSupportMode;
};

export type CustomPracticeExecutableSessionPlan = {
  source: 'custom_practice';
  mode: PracticeMode;
  curriculum: string;
  syllabus: SyllabusType | null;
  topicId: string | null;
  sessionLength: number;
  supportMode: CustomPracticeSupportMode;
};

