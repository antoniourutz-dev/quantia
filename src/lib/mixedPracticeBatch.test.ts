import { describe, expect, it, vi } from 'vitest';
import type { Question, SyllabusType } from '../types';
import { getBalancedMixedPracticeBatch } from './mixedPracticeBatch';

const question = (id: string, syllabus: SyllabusType) => ({ id, syllabus, text: id }) as Question;

describe('getBalancedMixedPracticeBatch', () => {
  it('incluye preguntas comunes y específicas en un lote mixto', async () => {
    const pools = {
      common: Array.from({ length: 20 }, (_, index) => question(`c${index}`, 'common')),
      specific: Array.from({ length: 20 }, (_, index) => question(`s${index}`, 'specific')),
    };
    const loadScope = vi.fn(async (scope: SyllabusType, count: number) => pools[scope].slice(0, count));

    const result = await getBalancedMixedPracticeBatch({ count: 10, loadScope });

    expect(result).toHaveLength(10);
    expect(result.filter((item) => item.syllabus === 'common')).toHaveLength(5);
    expect(result.filter((item) => item.syllabus === 'specific')).toHaveLength(5);
  });

  it('rellena desde el otro temario cuando uno no tiene suficientes preguntas', async () => {
    const pools = {
      common: Array.from({ length: 20 }, (_, index) => question(`c${index}`, 'common')),
      specific: [question('s0', 'specific')],
    };
    const loadScope = vi.fn(async (scope: SyllabusType, count: number) => pools[scope].slice(0, count));

    const result = await getBalancedMixedPracticeBatch({ count: 10, loadScope });

    expect(result).toHaveLength(10);
    expect(result.some((item) => item.syllabus === 'specific')).toBe(true);
    expect(result.filter((item) => item.syllabus === 'common')).toHaveLength(9);
  });

  it('mantiene un inicio determinista sin perder la mezcla cuando se solicita en orden', async () => {
    const pools = {
      common: Array.from({ length: 10 }, (_, index) => question(`c${index}`, 'common')),
      specific: Array.from({ length: 10 }, (_, index) => question(`s${index}`, 'specific')),
    };

    const result = await getBalancedMixedPracticeBatch({
      count: 6,
      randomizeStart: false,
      loadScope: async (scope, count) => pools[scope].slice(0, count),
    });

    expect(result.map((item) => item.id)).toEqual(['c0', 's0', 'c1', 's1', 'c2', 's2']);
  });
});
