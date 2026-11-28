import { describe, expect, it } from 'vitest';
import { toQuestionOriginLabel } from './questionContracts';

describe('toQuestionOriginLabel', () => {
  it('identifica las preguntas propias como Kuantia', () => {
    expect(toQuestionOriginLabel('own')).toBe('Kuantia');
  });
  it('agrupa los orígenes externos sin mostrar el proveedor', () => {
    expect(toQuestionOriginLabel('academy')).toBe('Externo');
    expect(toQuestionOriginLabel('official')).toBe('Externo');
  });
  it('no atribuye una procedencia desconocida a Kuantia', () => {
    for (const value of [null, undefined, '', 'unknown']) {
      expect(toQuestionOriginLabel(value)).toBeUndefined();
    }
  });
});
