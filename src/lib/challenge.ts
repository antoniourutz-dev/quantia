import type { Question, SyllabusType } from '../types';

export const CHALLENGE_OPTIONS = {
  common: { count: 200, label: 'Común', labelEu: 'Orokorra', title: 'Desafío · Común' },
  specific: { count: 500, label: 'Específico', labelEu: 'Espezifikoa', title: 'Desafío · Específico' },
  mixed: { count: 700, label: 'Común + Específico', labelEu: 'Orokorra + Espezifikoa', title: 'Desafío · Común + Específico' },
} as const;

export type ChallengeScope = keyof typeof CHALLENGE_OPTIONS;
export type ChallengeResult = { id: string; startedAt: string; correct: number; total: number };

export async function loadChallengeQuestions(
  scope: ChallengeScope,
  loadScope: (scope: SyllabusType) => Promise<Question[]>,
): Promise<Question[]> {
  const scopes: SyllabusType[] = scope === 'mixed' ? ['common', 'specific'] : [scope];
  const groups = await Promise.all(scopes.map(loadScope));
  const result: Question[] = [];
  const ids = new Set<string>();
  for (const [index, group] of groups.entries()) {
    if (group.length !== CHALLENGE_OPTIONS[scopes[index]].count) return [];
    const sorted = [...group].sort((a, b) =>
      (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) ||
      a.id.localeCompare(b.id),
    );
    for (const question of sorted) {
      if (ids.has(question.id)) return [];
      ids.add(question.id);
      result.push(question);
    }
  }
  return result;
}

export function shuffleChallengeQuestions(questions: Question[]): Question[] {
  const result = [...questions];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}
