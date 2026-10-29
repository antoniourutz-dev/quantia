import { describe, expect, it } from 'vitest';
import { mapPracticeMode, mapQuestion, readNumber, readText } from './quantiaMappers';

describe('readText', () => {
  it('trims and returns null for empty', () => {
    expect(readText(null)).toBeNull();
    expect(readText(undefined)).toBeNull();
    expect(readText('  ')).toBeNull();
    expect(readText('  x  ')).toBe('x');
  });
});

describe('readNumber', () => {
  it('parses finite numbers and uses fallback', () => {
    expect(readNumber('42', 0)).toBe(42);
    expect(readNumber('nope', 7)).toBe(7);
  });
});

describe('mapPracticeMode', () => {
  it('maps known modes', () => {
    expect(mapPracticeMode('simulacro')).toBe('simulacro');
    expect(mapPracticeMode('CUSTOM')).toBe('custom');
  });

  it('defaults unknown to standard', () => {
    expect(mapPracticeMode('unknown')).toBe('standard');
  });
});

describe('mapQuestion', () => {
  it('keeps a question without an assigned answer as unscored', () => {
    expect(mapQuestion({
      id: 1,
      pregunta: 'Pregunta sin clave',
      opcion_a: 'A',
      opcion_b: 'B',
      opcion_c: 'C',
      opcion_d: 'D',
      respuesta_correcta: null,
      grupo: 'especifico',
    })).toMatchObject({ id: '1', correctAnswer: null, syllabus: 'specific' });
  });
});
