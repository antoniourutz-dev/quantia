import { describe, expect, it } from 'vitest';
import {
  buildFallbackCurriculumOptions,
  formatCurriculumLabel,
  getSharedCurriculumSources,
} from './quantiaApi';

describe('Electromedicina curriculum', () => {
  it('is available in the fallback opposition catalog', () => {
    expect(buildFallbackCurriculumOptions()).toContainEqual({
      id: 'osakidetza_electromedicina',
      label: 'Electromedicina',
    });
  });

  it.each([
    'osakidetza_electromedicina',
    'osakidetza-electromedicina',
    'electromedicina',
  ])('uses a Spanish display label for %s', (curriculum) => {
    expect(formatCurriculumLabel(curriculum)).toBe('Electromedicina');
  });

  it('uses Administrativo only as its common question source', () => {
    expect(getSharedCurriculumSources('osakidetza_electromedicina', 'all')).toEqual([
      { curriculum: 'osakidetza_admin', scope: 'common' },
    ]);
    expect(getSharedCurriculumSources('osakidetza_electromedicina', 'common')).toEqual([
      { curriculum: 'osakidetza_admin', scope: 'common' },
    ]);
    expect(getSharedCurriculumSources('osakidetza_electromedicina', 'specific')).toEqual([]);
  });
});
