import { beforeEach, describe, expect, it } from 'vitest';
import {
  PRACTICE_MODE_IDS,
  normalizePracticeModeIds,
  readVisiblePracticeModeIds,
  writeVisiblePracticeModeIds,
} from './practiceModeVisibility';

describe('practice mode visibility preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('muestra todas las formas de practicar por defecto', () => {
    expect(readVisiblePracticeModeIds('new-student')).toEqual(PRACTICE_MODE_IDS);
  });

  it('guarda una selección independiente para cada alumno', () => {
    writeVisiblePracticeModeIds('student-1', ['standard', 'custom']);
    writeVisiblePracticeModeIds('student-2', ['quick']);

    expect(readVisiblePracticeModeIds('student-1')).toEqual(['standard', 'custom']);
    expect(readVisiblePracticeModeIds('student-2')).toEqual(['quick']);
  });

  it('descarta identificadores desconocidos y duplicados', () => {
    expect(normalizePracticeModeIds(['standard', 'unknown', 'standard', 'custom'])).toEqual([
      'standard',
      'custom',
    ]);
  });
});
