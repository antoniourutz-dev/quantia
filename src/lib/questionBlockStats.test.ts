import {
  buildQuestionBlockPerformance,
  rankQuestionPerformance,
  selectMostFailedQuestionIds,
} from './questionBlockStats';

describe('buildQuestionBlockPerformance', () => {
  it('separa comun y especifico y conserva bloques sin intentos', () => {
    const result = buildQuestionBlockPerformance(
      [
        { id: 'c1', number: 1, scope: 'common', text: 'Comun uno' },
        { id: 'c2', number: 10, scope: 'common', text: 'Comun diez' },
        { id: 'c3', number: 11, scope: 'common', text: 'Comun once' },
        { id: 's1', number: 1, scope: 'specific', text: 'Especifica uno' },
      ],
      [
        { eventId: 'view-1', questionId: 'c1', questionNumber: null, scope: null, isCorrect: true },
        { eventId: 'view-2', questionId: 'c1', questionNumber: null, scope: null, isCorrect: false },
        { eventId: 'view-3', questionId: 'c2', questionNumber: null, scope: null, isCorrect: null },
        { questionId: 's1', questionNumber: null, scope: null, isCorrect: true },
      ],
    );

    expect(result).toEqual([
      expect.objectContaining({ scope: 'common', start: 1, end: 10, questionCount: 2, attemptedQuestionCount: 2, views: 3, attempts: 2, correct: 1, incorrect: 1, accuracyRate: 0.5 }),
      expect.objectContaining({ scope: 'common', start: 11, end: 20, questionCount: 1, attemptedQuestionCount: 0, attempts: 0, correct: 0, incorrect: 0, accuracyRate: null }),
      expect.objectContaining({ scope: 'specific', start: 1, end: 10, questionCount: 1, attemptedQuestionCount: 1, attempts: 1, correct: 1, incorrect: 0, accuracyRate: 1 }),
    ]);
    expect(result[0].questions).toEqual([
      expect.objectContaining({ id: 'c1', number: 1, views: 2, attempts: 2, correct: 1, incorrect: 1, accuracyRate: 0.5 }),
      expect.objectContaining({ id: 'c2', number: 10, views: 1, attempts: 0, correct: 0, incorrect: 0, accuracyRate: null }),
    ]);
  });

  it('clasifica las preguntas dentro de cada parte del temario', () => {
    const blocks = buildQuestionBlockPerformance(
      [
        { id: 'c1', number: 1, scope: 'common', text: 'Comun uno' },
        { id: 'c2', number: 2, scope: 'common', text: 'Comun dos' },
        { id: 'c3', number: 3, scope: 'common', text: 'Comun tres' },
        { id: 's1', number: 1, scope: 'specific', text: 'Especifica uno' },
      ],
      [
        { eventId: 'c1-1', questionId: 'c1', questionNumber: null, scope: null, isCorrect: true },
        { eventId: 'c1-2', questionId: 'c1', questionNumber: null, scope: null, isCorrect: true },
        { eventId: 'c2-1', questionId: 'c2', questionNumber: null, scope: null, isCorrect: false },
        { eventId: 'c2-2', questionId: 'c2', questionNumber: null, scope: null, isCorrect: false },
        { eventId: 'c2-3', questionId: 'c2', questionNumber: null, scope: null, isCorrect: true },
        { eventId: 's1-1', questionId: 's1', questionNumber: null, scope: null, isCorrect: true },
      ],
    );

    expect(rankQuestionPerformance(blocks, 'common', 'most_viewed').map((question) => question.id))
      .toEqual(['c2', 'c1', 'c3']);
    expect(rankQuestionPerformance(blocks, 'common', 'least_viewed').map((question) => question.id))
      .toEqual(['c3', 'c1', 'c2']);
    expect(rankQuestionPerformance(blocks, 'common', 'most_correct').map((question) => question.id))
      .toEqual(['c1', 'c2', 'c3']);
    expect(rankQuestionPerformance(blocks, 'common', 'most_incorrect').map((question) => question.id))
      .toEqual(['c2', 'c1', 'c3']);
    expect(rankQuestionPerformance(blocks, 'specific', 'most_viewed').map((question) => question.id))
      .toEqual(['s1']);
  });

  it('ordena aciertos y fallos por porcentaje, no por el recuento absoluto', () => {
    const blocks = buildQuestionBlockPerformance(
      [
        { id: 'many-correct', number: 1, scope: 'common', text: 'Ocho de diez' },
        { id: 'perfect', number: 2, scope: 'common', text: 'Dos de dos' },
        { id: 'many-errors', number: 3, scope: 'common', text: 'Cuatro de diez' },
        { id: 'always-wrong', number: 4, scope: 'common', text: 'Cero de uno' },
        { id: 'unattempted', number: 5, scope: 'common', text: 'Sin intentos' },
      ],
      [
        ...Array.from({ length: 10 }, (_, index) => ({
          eventId: `many-correct-${index}`,
          questionId: 'many-correct',
          questionNumber: null,
          scope: null,
          isCorrect: index < 8,
        })),
        ...Array.from({ length: 2 }, (_, index) => ({
          eventId: `perfect-${index}`,
          questionId: 'perfect',
          questionNumber: null,
          scope: null,
          isCorrect: true,
        })),
        ...Array.from({ length: 10 }, (_, index) => ({
          eventId: `many-errors-${index}`,
          questionId: 'many-errors',
          questionNumber: null,
          scope: null,
          isCorrect: index < 4,
        })),
        { eventId: 'always-wrong-0', questionId: 'always-wrong', questionNumber: null, scope: null, isCorrect: false },
      ],
    );

    expect(rankQuestionPerformance(blocks, 'common', 'most_correct').map((question) => question.id))
      .toEqual(['perfect', 'many-correct', 'many-errors', 'always-wrong', 'unattempted']);
    expect(rankQuestionPerformance(blocks, 'common', 'most_incorrect').map((question) => question.id))
      .toEqual(['always-wrong', 'many-errors', 'many-correct', 'perfect', 'unattempted']);
  });

  it('selecciona solo preguntas vistas y falladas, priorizando las que mas se fallan', () => {
    const blocks = buildQuestionBlockPerformance(
      [
        { id: 'c1', number: 1, scope: 'common', text: 'Comun uno' },
        { id: 'c2', number: 2, scope: 'common', text: 'Comun dos' },
        { id: 'c3', number: 3, scope: 'common', text: 'Comun tres' },
        { id: 's1', number: 1, scope: 'specific', text: 'Especifica uno' },
      ],
      [
        { eventId: 'c1-1', questionId: 'c1', questionNumber: null, scope: null, isCorrect: false },
        { eventId: 'c1-2', questionId: 'c1', questionNumber: null, scope: null, isCorrect: false },
        { eventId: 'c2-1', questionId: 'c2', questionNumber: null, scope: null, isCorrect: false },
        { eventId: 'c2-2', questionId: 'c2', questionNumber: null, scope: null, isCorrect: true },
        { eventId: 'c3-1', questionId: 'c3', questionNumber: null, scope: null, isCorrect: true },
        { eventId: 's1-1', questionId: 's1', questionNumber: null, scope: null, isCorrect: false },
      ],
    );

    expect(selectMostFailedQuestionIds(blocks, 'all', 10)).toEqual(['c1', 's1', 'c2']);
    expect(selectMostFailedQuestionIds(blocks, 'common', 1)).toEqual(['c1']);
    expect(selectMostFailedQuestionIds(blocks, 'specific', 10)).toEqual(['s1']);
  });
});
