import type { OptionKey, SyllabusType } from '../types';

export const QUESTION_BANK_LIST_SELECT =
  'id, numero, pregunta, respuesta_correcta, grupo, ley_referencia, temario_pregunta' as const;

const OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;

export const toOptionKey = (
  value: unknown,
  optionsByKey?: Record<OptionKey, string>,
): OptionKey | null => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'a' || normalized === 'b' || normalized === 'c' || normalized === 'd') {
      return normalized;
    }
    if (normalized === '1' || normalized === '2' || normalized === '3' || normalized === '4') {
      return OPTION_KEYS[Number(normalized) - 1] ?? null;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const index = Math.trunc(value) - 1;
    return OPTION_KEYS[index] ?? null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested =
      record.id ??
      record.key ??
      record.value ??
      record.text ??
      record.label ??
      record.option ??
      record.answer ??
      record.correct ??
      record.correctAnswer ??
      record.correct_answer;
    const resolved = toOptionKey(nested, optionsByKey);
    if (resolved) return resolved;
  }

  if (optionsByKey && typeof value === 'string') {
    const normalizedValue = value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalizedValue) {
      for (const key of OPTION_KEYS) {
        const optionText = optionsByKey[key];
        if (!optionText) continue;
        const normalizedOption = optionText.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
        if (normalizedOption === normalizedValue) return key;
      }
    }
  }

  return null;
};

export const parseSyllabusType = (value: unknown): SyllabusType | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'common' || normalized === 'comun') return 'common';
  if (normalized === 'specific' || normalized === 'especifico' || normalized === 'específico') return 'specific';
  return null;
};

export const toSyllabusType = (value: unknown, fallback: SyllabusType = 'specific'): SyllabusType =>
  parseSyllabusType(value) ?? fallback;

export const toDbGrupo = (syllabus: SyllabusType): 'comun' | 'especifico' =>
  syllabus === 'common' ? 'comun' : 'especifico';
