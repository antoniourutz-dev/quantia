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

describe('Mantenimiento curriculum', () => {
  it('is available in the fallback opposition catalog', () => {
    expect(buildFallbackCurriculumOptions()).toContainEqual({
      id: 'osakidetza_mantenimiento_instalaciones',
      label: 'Mantenimiento e Instalaciones',
    });
  });

  it('uses the 200 common questions from Técnico Superior Administración y Gestión', () => {
    const source = { curriculum: 'tecnico_superior_administracion_y_gestion', scope: 'common' };
    expect(getSharedCurriculumSources('osakidetza_mantenimiento_instalaciones', 'all')).toEqual([source]);
    expect(getSharedCurriculumSources('osakidetza_mantenimiento_instalaciones', 'common')).toEqual([source]);
    expect(getSharedCurriculumSources('osakidetza_mantenimiento_instalaciones', 'specific')).toEqual([]);
  });
});

describe('Técnico Medio Administración y Gestión curriculum', () => {
  it('is available in the fallback opposition catalog', () => {
    expect(buildFallbackCurriculumOptions()).toContainEqual({
      id: 'osakidetza_tecnico_medio_administracion_gestion',
      label: 'Técnico/a Medio Administración y Gestión',
    });
  });

  it.each([
    'osakidetza_tecnico_medio_administracion_gestion',
    'osakidetza-tecnico-medio-administracion-y-gestion',
    'técnico medio administración y gestión',
  ])('uses the expected display label for %s', (curriculum) => {
    expect(formatCurriculumLabel(curriculum)).toBe('Técnico/a Medio Administración y Gestión');
  });

  it('uses the same 200 common questions as Mantenimiento', () => {
    const source = { curriculum: 'tecnico_superior_administracion_y_gestion', scope: 'common' };
    expect(getSharedCurriculumSources('osakidetza_tecnico_medio_administracion_gestion', 'all')).toEqual([source]);
    expect(getSharedCurriculumSources('osakidetza_tecnico_medio_administracion_gestion', 'common')).toEqual([source]);
    expect(getSharedCurriculumSources('osakidetza_tecnico_medio_administracion_gestion', 'specific')).toEqual([]);
  });
});
