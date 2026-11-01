import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CUSTOM_PRACTICE_SUPPORT,
  readCustomPracticeSupport,
  writeCustomPracticeSupport,
} from './customPracticePreferences';

describe('customPracticePreferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('uses disabled aids by default', () => {
    expect(readCustomPracticeSupport('student-1')).toEqual(DEFAULT_CUSTOM_PRACTICE_SUPPORT);
  });

  it('stores aids independently for each student', () => {
    writeCustomPracticeSupport('student-1', { showMarks: true, showNotes: false });

    expect(readCustomPracticeSupport('student-1')).toEqual({ showMarks: true, showNotes: false });
    expect(readCustomPracticeSupport('student-2')).toEqual(DEFAULT_CUSTOM_PRACTICE_SUPPORT);
  });
});
