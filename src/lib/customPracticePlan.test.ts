import { describe, expect, it } from 'vitest';
import { buildExecutableSessionPlanFromCustomPractice } from './customPracticePlan';

describe('buildExecutableSessionPlanFromCustomPractice', () => {
  it.each([
    ['sequence', false],
    ['random', true],
  ] as const)('maps %s order to randomize=%s', (order, randomize) => {
    const plan = buildExecutableSessionPlanFromCustomPractice({
      curriculum: 'test_curriculum',
      contentScope: 'common_and_specific',
      topicMode: { type: 'all_topics' },
      sessionLength: 50,
      order,
      supportMode: { showMarks: false, showNotes: false },
    });

    expect(plan.randomize).toBe(randomize);
    expect(plan.syllabus).toBeNull();
  });
});
