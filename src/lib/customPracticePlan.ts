import type { SyllabusType } from '../types';
import type {
  CustomPracticeConfig,
  CustomPracticeContentScope,
  CustomPracticeExecutableSessionPlan,
} from '../domain/customPractice/customPracticeTypes';

const toSyllabus = (scope: CustomPracticeContentScope): SyllabusType | null => {
  if (scope === 'common_only') return 'common';
  if (scope === 'specific_only') return 'specific';
  return null;
};

export const buildExecutableSessionPlanFromCustomPractice = (
  config: CustomPracticeConfig,
): CustomPracticeExecutableSessionPlan => {
  const syllabus = toSyllabus(config.contentScope);
  const topicId = config.topicMode.type === 'single_topic' ? config.topicMode.topicId : null;
  const sessionLength = Math.max(1, Math.min(200, Math.round(config.sessionLength)));

  return {
    source: 'custom_practice',
    mode: 'custom',
    curriculum: config.curriculum,
    syllabus,
    topicId,
    sessionLength,
    supportMode: config.supportMode,
  };
};

