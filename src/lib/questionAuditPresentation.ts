/** Presentational audit metadata; never changes official alternatives or grading keys. */
export type QuestionAuditSeverity = 'conflict' | 'warning' | null;

const AUDIT_TAG = String.raw`\[(?:dudosa|pendiente\s+(?:de\s+)?auditor[ií]a)\]`;
const PREFIX = new RegExp(String.raw`^\s*` + AUDIT_TAG + String.raw`\s*`, 'i');
const SUFFIX = new RegExp(String.raw`\s*` + AUDIT_TAG + String.raw`\s*$`, 'i');
const EDITORIAL_MARKER = '[INCIDENCIA_AUDITADA: MOSTRAR_ASTERISCO_EN_UI]';

export function readQuestionAuditPresentation(statement: string, editorial: unknown) {
  const raw = String(statement ?? '');
  const hadTag = PREFIX.test(raw) || SUFFIX.test(raw);
  const text = raw.replace(PREFIX, '').replace(SUFFIX, '').trim();
  const note = typeof editorial === 'string' ? editorial.trim() : '';
  const explicit = note.startsWith(EDITORIAL_MARKER);
  const incident = hadTag || explicit;
  const severity: QuestionAuditSeverity = !incident
    ? null
    : explicit && note.includes('[AUDITORIA_TMAG_20261111:ADVERTENCIA]')
      ? 'warning'
      : 'conflict';
  return { text, incident, severity };
}
