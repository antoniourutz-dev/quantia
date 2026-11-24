import { beforeEach, describe, expect, it } from 'vitest';
import {
  PRACTICE_MODE_IDS,
  normalizePracticeModeIds,
  readVisiblePracticeModeIds,
  writeVisiblePracticeModeIds,
} from './practiceModeVisibility';

describe('practice mode visibility preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('expone los 6 modos consolidados sin quick', () => {
    expect(PRACTICE_MODE_IDS).toEqual(['standard', 'errors', 'topics', 'simulacro', 'challenge', 'custom']);
  });

  it('muestra todas las formas de practicar por defecto', () => {
    expect(readVisiblePracticeModeIds('new-student')).toEqual(PRACTICE_MODE_IDS);
  });

  it('guarda una selección independiente para cada alumno', () => {
    writeVisiblePracticeModeIds('student-1', ['standard', 'custom']);
    writeVisiblePracticeModeIds('student-2', ['errors', 'simulacro']);

    expect(readVisiblePracticeModeIds('student-1')).toEqual(['standard', 'custom']);
    expect(readVisiblePracticeModeIds('student-2')).toEqual(['errors', 'simulacro']);
  });

  it('descarta identificadores desconocidos y duplicados', () => {
    expect(normalizePracticeModeIds(['standard', 'unknown', 'standard', 'custom'])).toEqual([
      'standard',
      'custom',
    ]);
  });

  it('migra el modo legado quick a standard y deduplica', () => {
    expect(normalizePracticeModeIds(['quick'])).toEqual(['standard']);
    expect(normalizePracticeModeIds(['quick', 'standard', 'errors'])).toEqual(['standard', 'errors']);

    window.localStorage.setItem(
      'quantia.visible-practice-modes.v2:legacy-student',
      JSON.stringify(['quick']),
    );
    expect(readVisiblePracticeModeIds('legacy-student')).toEqual(['standard']);
  });
});
