import { beforeEach, describe, expect, it } from 'vitest';
import { readVisibleCurriculumIds, writeVisibleCurriculumIds } from './curriculumVisibility';

describe('curriculum visibility preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('guarda una selección independiente para cada alumno', () => {
    writeVisibleCurriculumIds('student-1', ['opposition-a', 'opposition-b']);
    writeVisibleCurriculumIds('student-2', ['opposition-c']);

    expect(readVisibleCurriculumIds('student-1')).toEqual(['opposition-a', 'opposition-b']);
    expect(readVisibleCurriculumIds('student-2')).toEqual(['opposition-c']);
  });

  it('devuelve null cuando todavía no existe una preferencia', () => {
    expect(readVisibleCurriculumIds('new-student')).toBeNull();
  });
});
