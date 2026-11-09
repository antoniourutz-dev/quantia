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
  it('marks only the targeted curriculum and prefix without changing the statement', () => {
    const row = { id: 1, pregunta: 'Pregunta original', opcion_a: 'A', opcion_b: 'B', opcion_c: 'C', opcion_d: 'D', curriculum_key: 'osakidetza_tecnico_superior_mantenimiento_instalaciones', explicacion_editorial: '[INCIDENCIA_AUDITADA: MOSTRAR_ASTERISCO_EN_UI] Detalle' };
    expect(mapQuestion(row)).toMatchObject({ text: 'Pregunta original', auditIncident: true });
    expect(mapQuestion({ ...row, curriculum_key: 'otro' })?.auditIncident).toBe(false);
    expect(mapQuestion({ ...row, explicacion_editorial: 'Texto [INCIDENCIA_AUDITADA: MOSTRAR_ASTERISCO_EN_UI]' })?.auditIncident).toBe(false);
    expect(mapQuestion({ ...row, explicacion_editorial: null })?.auditIncident).toBe(false);
  });
  it('converts a [dudosa] label into an incident marker without exposing the prefix', () => {
    const row = {
      id: 7, pregunta: '[dudosa] Texto oficial',
      opcion_a: 'Uno', opcion_b: 'Dos', opcion_c: 'Tres', opcion_d: 'Cuatro',
      curriculum: 'osakidetza_mantenimiento_instalaciones',
      grupo: 'especifico',
      respuesta_correcta: 'C',
    };
    expect(mapQuestion(row)).toMatchObject({
      id: '7', text: 'Texto oficial', auditIncident: true,
      correctAnswer: 'c', syllabus: 'specific',
    });
    expect(mapQuestion({ ...row, pregunta: 'Texto oficial' })?.auditIncident).toBe(false);
  });

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

