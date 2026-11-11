import { describe, expect, it } from 'vitest';
import { readQuestionAuditPresentation } from './questionAuditPresentation';

describe('question audit presentation', () => {
  it('strips only editorial tags from either edge', () => {
    const a = readQuestionAuditPresentation('[dudosa] ¿Qué establece la norma?', null);
    const b = readQuestionAuditPresentation('¿Qué establece la norma? [dudosa]', null);
    const c = readQuestionAuditPresentation('¿Qué establece la norma? [pendiente de auditoría]', null);
    expect(a.text).toBe('¿Qué establece la norma?');
    expect(b.text).toBe('¿Qué establece la norma?');
    expect(c.text).toBe('¿Qué establece la norma?');
    expect(a.incident).toBe(true);
    expect(b.severity).toBe('conflict');
    expect(pending.severity).toBe('pending');
    expect(pending.text).toBe('Enunciado oficial');
  });
  it('distinguishes a validated caveat from a conflict', () => {
    const tag = '[INCIDENCIA_AUDITADA: MOSTRAR_ASTERISCO_EN_UI]';
    const a = readQuestionAuditPresentation('Enunciado oficial', tag + ' [AUDITORIA_TMAG_20261111:ADVERTENCIA] Nota');
    const b = readQuestionAuditPresentation('Enunciado oficial', tag + ' [AUDITORIA_TMAG_20261111:CONFLICTIVA] Nota');
    const pending = readQuestionAuditPresentation('Enunciado oficial [dudosa]', tag + ' [AUDITORIA_TMAG_20261111:PENDIENTE] Pendiente de documentación');
    expect(a).toEqual({text:'Enunciado oficial',incident:true,severity:'warning'});
    expect(b.severity).toBe('conflict');
    expect(readQuestionAuditPresentation('Sin marca', null).incident).toBe(false);
  });
  it('preserves bracketed terms inside a question', () => {
    const statement = 'Referencia [dudosa] y texto intacto';
    expect(readQuestionAuditPresentation(statement, null).text).toBe(statement);
  });
});
