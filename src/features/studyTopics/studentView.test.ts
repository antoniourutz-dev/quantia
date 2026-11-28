import { describe, expect, it } from 'vitest';
import { buildStudentViewContext, leftoverCodes, toStudentView } from './studentView';

const manual = [
  '## Cómo usar este manual',
  'Cada apartado lleva el identificador (por ejemplo, `R002`).',
  '## Mapa del tema',
  '```',
  'DERECHOS (E01)',
  ' │  R001 fundamento   R002 titulares',
  'E02 DEBERES',
  '```',
  '## 1. Derechos y libertades (E01)',
  '### 1.1. Dignidad <a id="T01-E01-R001"></a>`R001`',
  '### 1.2. Titulares (apoyo) <a id="T01-E01-R002"></a>`R002` <a id="T01-E01-R003"></a>`R003`',
  'Se estudia en E02 (ver R004).',
  '## 2. Deberes (E02 y E03)',
  '### 2.1. Castellano <a id="T01-E02-R004"></a>`R004`',
].join('\n');

const errores = [
  'La app enlaza a la ficha cuando el alumno falla una pregunta cuyo distractor lleva ese `error_tipico`.',
  '## <a id="PLAZO"></a>PLAZO · Equivocar un plazo',
  'Texto.',
  '## Tabla `error_tipico → regla → ancla del manual`',
  '| error_tipico | Reglas | Anclas |',
  '|---|---|---|',
  '| `PLAZO` | R001, R002, R003 | [R001](GV-T01_manual.md#T01-E01-R001) |',
].join('\n');

const ctx = buildStudentViewContext('GV-ADM-C1-2026-T01', manual, errores);

describe('studentView', () => {
  it('lee reglas, bloques y errores del tema', () => {
    expect(ctx.rules.get('R001')).toEqual({ label: '1.1', anchor: 'T01-E01-R001' });
    expect(ctx.rules.get('R003')?.label).toBe('1.2');
    expect(ctx.blocks.get('E03')).toBe('2');
    expect(ctx.errors.get('PLAZO')).toBe('Equivocar un plazo');
  });

  it('quita los códigos de los encabezados y traduce las referencias del manual', () => {
    const view = toStudentView(manual, ctx, 'manual');
    expect(view).toContain('### 1.1. Dignidad <a id="T01-E01-R001"></a>\n');
    expect(view).toContain('## 2. Deberes\n');
    expect(view).toContain('Se estudia en bloque 2 (ver [2.1](#T01-E02-R004)).');
    expect(view).toContain(' │  1.1  fundamento   1.2  titulares');
    expect(view).toContain('\n2.  DEBERES');
    expect(leftoverCodes(view)).toEqual([]);
  });

  it('en el solucionario enlaza al manual y nombra el error típico', () => {
    const view = toStudentView('**1.1** · Reglas: R001, R003 · Error que evita: `PLAZO`', ctx, 'soluciones');
    expect(view).toBe(
      '**1.1** · Repasa: [1.1](GV-ADM-C1-2026-T01_manual.md#T01-E01-R001), [1.2](GV-ADM-C1-2026-T01_manual.md#T01-E01-R003) · Error típico: [Equivocar un plazo](GV-ADM-C1-2026-T01_errores.md#PLAZO)  ',
    );
  });

  it('convierte la tabla final de errores en «dónde repasarlo»', () => {
    const view = toStudentView(errores, ctx, 'errores');
    expect(view).toContain('## <a id="PLAZO"></a>Equivocar un plazo');
    expect(view).toContain('## Dónde repasar cada error');
    expect(view).toContain('| Error | Dónde repasarlo |\n|---|---|\n');
    expect(view).toContain(
      '| [Equivocar un plazo](#PLAZO) | [1.1](GV-ADM-C1-2026-T01_manual.md#T01-E01-R001), [1.2](GV-ADM-C1-2026-T01_manual.md#T01-E01-R002) |',
    );
    expect(view).not.toContain('Anclas');
  });
});
