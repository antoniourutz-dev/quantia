import { describe, expect, it } from 'vitest';
import { loadChallengeQuestions, orderTopicQuestions } from './challenge';
import type { Question, SyllabusType } from '../types';

const makeQuestion = (id: string, number: number | undefined, syllabus: SyllabusType): Question => ({
  id,
  number,
  text: `Pregunta ${id}`,
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
    { id: 'd', text: 'D' },
  ],
  correctAnswer: 'a',
  explanation: 'Exp',
  syllabus,
  category: 'Tema 1',
  questionScope: syllabus,
});

describe('challenge', () => {
  it('soporta tamaños dinámicos de banco (common, specific y mixed) distintos de 200/500/700', async () => {
    const commonBank = Array.from({ length: 45 }, (_, i) => makeQuestion(`c-${i + 1}`, i + 1, 'common'));
    const specificBank = Array.from({ length: 120 }, (_, i) => makeQuestion(`s-${i + 1}`, i + 1, 'specific'));

    const loadScope = async (scope: SyllabusType) => (scope === 'common' ? commonBank : specificBank);

    const commonResult = await loadChallengeQuestions('common', loadScope);
    expect(commonResult).toHaveLength(45);

    const specificResult = await loadChallengeQuestions('specific', loadScope);
    expect(specificResult).toHaveLength(120);

    const mixedResult = await loadChallengeQuestions('mixed', loadScope);
    expect(mixedResult).toHaveLength(165);
    expect(mixedResult[0].id).toBe('c-1');
    expect(mixedResult[45].id).toBe('s-1');
  });

  it('ordena las preguntas por number ascendente y desempata por id', async () => {
    const unsorted: Question[] = [
      makeQuestion('q-b', 2, 'common'),
      makeQuestion('q-no-num', undefined, 'common'),
      makeQuestion('q-a', 2, 'common'),
      makeQuestion('q-first', 1, 'common'),
    ];

    const result = await loadChallengeQuestions('common', async () => unsorted);
    expect(result.map((q) => q.id)).toEqual(['q-first', 'q-a', 'q-b', 'q-no-num']);

    const orderedTopic = orderTopicQuestions(unsorted, false);
    expect(orderedTopic.map((q) => q.id)).toEqual(['q-first', 'q-a', 'q-b', 'q-no-num']);
  });

  it('devuelve [] si algún ámbito requerido está vacío o contiene IDs duplicados', async () => {
    const commonBank = [makeQuestion('c-1', 1, 'common')];

    const emptySpecific = await loadChallengeQuestions('mixed', async (scope) =>
      scope === 'common' ? commonBank : [],
    );
    expect(emptySpecific).toEqual([]);

    const duplicateIds = await loadChallengeQuestions('common', async () => [
      makeQuestion('dup-1', 1, 'common'),
      makeQuestion('dup-1', 2, 'common'),
    ]);
    expect(duplicateIds).toEqual([]);
  });
});
