import { selectAdaptiveQuestions, type AdaptiveQuestionActivity } from './adaptiveQuestionSelection';

const questions = Array.from({ length: 8 }, (_, index) => ({ id: `q${index + 1}` }));
const event = (
  questionId: string,
  viewedAt: string,
  isCorrect: boolean | null,
): AdaptiveQuestionActivity => ({ questionId, viewedAt, isCorrect });

describe('selectAdaptiveQuestions', () => {
  it('evita la repeticion inmediata de un fallo cuando hay alternativas', () => {
    const now = Date.parse('2026-10-26T12:00:00.000Z');
    const activity = questions.map((question, index) =>
      event(question.id, `2026-10-${String(20 + index).padStart(2, '0')}T08:00:00.000Z`, true),
    );
    activity.push(event('q1', '2026-10-26T11:55:00.000Z', false));

    const result = selectAdaptiveQuestions({ questions, count: 3, activity, now, random: () => 0.5 });

    expect(result.map((question) => question.id)).not.toContain('q1');
  });

  it('permite hasta tres apariciones diarias si la ultima respuesta sigue siendo incorrecta', () => {
    const now = Date.parse('2026-10-26T18:00:00.000Z');
    const activity = questions.flatMap((question, index) => [
      event(question.id, `2026-10-${String(10 + index).padStart(2, '0')}T08:00:00.000Z`, true),
    ]);
    activity.push(
      event('q1', '2026-10-26T08:00:00.000Z', false),
      event('q1', '2026-10-26T12:00:00.000Z', false),
      ...Array.from({ length: 12 }, (_, index) => event(`q${(index % 7) + 2}`, `2026-10-26T${String(12 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}:00.000Z`, true)),
    );

    const result = selectAdaptiveQuestions({ questions, count: 8, activity, now, random: () => 0.5 });

    expect(result.map((question) => question.id)).toContain('q1');
  });

  it('no devuelve preguntas duplicadas aunque tenga que relajar los limites diarios', () => {
    const now = Date.parse('2026-10-26T18:00:00.000Z');
    const activity = questions.flatMap((question) => [
      event(question.id, '2026-10-26T09:00:00.000Z', true),
      event(question.id, '2026-10-26T10:00:00.000Z', true),
    ]);

    const result = selectAdaptiveQuestions({ questions, count: 8, activity, now, random: () => 0.5 });

    expect(new Set(result.map((question) => question.id)).size).toBe(8);
  });
});
