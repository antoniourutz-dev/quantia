import { describe, expect, it } from 'vitest';
import { formatStudyHash, parseStudyHash } from './route';
import { attachSolutions, rewriteUnusedErrors, splitSolutions } from './studentView';
import { topicState } from './progress';
import { parseRepasoCards } from './RepasoCards';
import { findInText, markdownToPlainText } from './search';
import type { StudyTopicSummary } from './types';

describe('dirección del lector', () => {
  it('ida y vuelta con ancla y nota', () => {
    const hash = formatStudyHash({ topicNumber: 28, kind: 'cuaderno', anchor: 'T28-E01-R001', annotationId: 'abc' });
    expect(hash).toBe('#temario/28/cuaderno?ancla=T28-E01-R001&nota=abc');
    expect(parseStudyHash(hash)).toEqual({ topicNumber: 28, kind: 'cuaderno', anchor: 'T28-E01-R001', annotationId: 'abc' });
  });
  it('rechaza otras direcciones y corrige el documento desconocido', () => {
    expect(parseStudyHash('#otra')).toBeNull();
    expect(parseStudyHash('#temario/x/manual')).toBeNull();
    expect(parseStudyHash('#temario/3/raro')?.kind).toBe('manual');
  });
});

describe('fichas de error que el tema no usa', () => {
  it('traduce los códigos de la frase', () => {
    expect(rewriteUnusedErrors('En este tema no se usan `COMPUTO` ni `CUANTIA`: el único plazo…')).toBe(
      'En este tema no hay fichas de error de cómputo de plazos ni de cuantías: el único plazo…',
    );
    expect(rewriteUnusedErrors('En este tema no se usa `CUANTIA`.')).toBe(
      'En este tema no hay fichas de error de cuantías.',
    );
  });
});

describe('Ver solución en el cuaderno', () => {
  const soluciones = [
    '## Bloque 1 · Fuentes',
    '',
    '**1.1** · Repasa: [1.1](X_manual.md#a) · Error típico: [Quitar](X_errores.md#R)  ',
    'CE art. 9.3: legalidad.',
    '',
    '**1.2** · Repasa: 1.2',
    'Ley, costumbre.',
    '',
    '## Supuesto integrado',
    '',
    '**S.1 → b.** Firma el Lehendakari.',
    '- a) no.',
  ].join('\n');
  const cuaderno = [
    '## Bloque 1 · Fuentes',
    '',
    '**1.1 (R).** Enumera los principios.',
    '',
    '**1.2 (D).** Dos órdenes:',
    '',
    '- (a) una',
    '- (b) otra',
    '',
    '---',
    '',
    '**S.1.** ¿Quién firma?',
    '',
    '- a) Solo el Lehendakari.',
  ].join('\n');
  it('separa las soluciones por número', () => {
    const map = splitSolutions(soluciones);
    expect([...map.keys()]).toEqual(['1.1', '1.2', 'S.1']);
    expect(map.get('1.1')).toMatch(/^Repasa: \[1\.1\]/);
    expect(map.get('S.1')).toMatch(/^\*\*Respuesta: b\.\*\* Firma/);
  });
  it('pone cada solución después de su ejercicio completo', () => {
    const out = attachSolutions(cuaderno, splitSolutions(soluciones));
    const lines = out.split('\n');
    const det = lines.reduce<number[]>((acc, l, i) => (l.startsWith('<details') ? [...acc, i] : acc), []);
    expect(det).toHaveLength(3);
    expect(lines[det[1] - 2]).toBe('- (b) otra');
    expect(out.indexOf('Ley, costumbre.')).toBeLessThan(out.indexOf('---'));
    expect(out.trimEnd().endsWith('</details>')).toBe(true);
  });
});

describe('progreso', () => {
  const topic: StudyTopicSummary = {
    id: 't',
    code: 'C-T01',
    topicNumber: 1,
    title: 'T',
    status: 'draft',
    documents: [
      { id: 'm', kind: 'manual', title: 'Manual', sortOrder: 1, current: { id: 'vm', version: '1.0', versionDate: null, status: 'draft', wordCount: 9000, normativeNote: null, sourcesNote: null } },
      { id: 'r', kind: 'repaso', title: 'Repaso', sortOrder: 2, current: { id: 'vr', version: '1.0', versionDate: null, status: 'draft', wordCount: 1000, normativeNote: null, sourcesNote: null } },
    ],
  };
  it('llegar al final no es «estudiado» y el manual pesa más', () => {
    const st = topicState(topic, {
      r: { documentId: 'r', versionId: 'vr', progress: 1, lastBlock: null, completedAt: null, updatedAt: '2026-11-28' },
    });
    expect(st.done).toBe(false);
    expect(st.doneCount).toBe(0);
    expect(st.read).toBeCloseTo(0.1);
  });
  it('estudiado solo si todos los documentos se marcan', () => {
    const row = (id: string, v: string) => ({ documentId: id, versionId: v, progress: 0.2, lastBlock: null, completedAt: '2026-11-01', updatedAt: '2026-11-01' });
    expect(topicState(topic, { m: row('m', 'vm'), r: row('r', 'vr') }).done).toBe(true);
  });
});

describe('tarjetas y búsqueda', () => {
  it('lee las reglas del repaso', () => {
    const cards = parseRepasoCards('Fuentes\n\n## Las 10 reglas\n\n1. **Jerarquía:** CE → ley.\n2. **Ley orgánica:** mayoría.\n\n## Cifras\n\n1. **No:** x');
    expect(cards).toEqual([
      { id: '1', front: 'Jerarquía', back: 'CE → ley.' },
      { id: '2', front: 'Ley orgánica', back: 'mayoría.' },
    ]);
  });
  it('busca sin tildes ni mayúsculas', () => {
    const text = markdownToPlainText('La **Constitución** y [el artículo](x.md#a) 9.3; constitucion');
    expect(findInText(text, 'CONSTITUCION')).toHaveLength(2);
    expect(text).not.toContain('x.md');
  });
});
