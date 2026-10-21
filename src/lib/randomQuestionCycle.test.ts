import { selectQuestionsFromRandomCycle } from './randomQuestionCycle';

const makeQuestions = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `q-${index + 1}`, text: `Pregunta ${index + 1}` }));

describe('selectQuestionsFromRandomCycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('recorre todo el banco antes de repetir una pregunta', () => {
    const questions = makeQuestions(7);
    const first = selectQuestionsFromRandomCycle({ questions, count: 3, storageKey: 'cycle:test' });
    const second = selectQuestionsFromRandomCycle({ questions, count: 3, storageKey: 'cycle:test' });
    const third = selectQuestionsFromRandomCycle({ questions, count: 1, storageKey: 'cycle:test' });

    expect(new Set([...first, ...second, ...third].map((question) => question.id))).toEqual(
      new Set(questions.map((question) => question.id)),
    );
  });

  it('mantiene el ciclo entre llamadas', () => {
    const questions = makeQuestions(6);
    const first = selectQuestionsFromRandomCycle({ questions, count: 4, storageKey: 'cycle:persisted' });
    const second = selectQuestionsFromRandomCycle({ questions, count: 2, storageKey: 'cycle:persisted' });

    expect(new Set([...first, ...second].map((question) => question.id)).size).toBe(6);
  });

  it('evita enunciados visualmente duplicados dentro del bloque cuando hay alternativas', () => {
    const questions = [
      { id: 'q-1', text: 'Mismo enunciado' },
      { id: 'q-2', text: '  mismo   enunciado ' },
      { id: 'q-3', text: 'Enunciado diferente' },
    ];
    const selected = selectQuestionsFromRandomCycle({ questions, count: 2, storageKey: 'cycle:visible' });

    expect(new Set(selected.map((question) => question.text.trim().replace(/\s+/g, ' ').toLowerCase())).size).toBe(2);
  });

  it('prioriza las preguntas nunca intentadas en el historial remoto', () => {
    const questions = makeQuestions(7);
    const selected = selectQuestionsFromRandomCycle({
      questions,
      count: 3,
      storageKey: 'cycle:history',
      historicallySeenIds: ['q-1', 'q-2', 'q-3', 'q-4'],
    });

    expect(new Set(selected.map((question) => question.id))).toEqual(new Set(['q-5', 'q-6', 'q-7']));
  });

  it('termina los no vistos y rellena el lote sin duplicados al comenzar una nueva vuelta', () => {
    const questions = makeQuestions(5);
    const selected = selectQuestionsFromRandomCycle({
      questions,
      count: 4,
      storageKey: 'cycle:boundary',
      historicallySeenIds: ['q-1', 'q-2', 'q-3'],
    });

    expect(selected.slice(0, 2).map((question) => question.id).sort()).toEqual(['q-4', 'q-5']);
    expect(new Set(selected.map((question) => question.id)).size).toBe(4);
  });

  it('mantiene una vuelta nueva cuando el historial ya cubre todo el banco', () => {
    const questions = makeQuestions(6);
    const historicallySeenIds = questions.map((question) => question.id);
    const first = selectQuestionsFromRandomCycle({
      questions,
      count: 4,
      storageKey: 'cycle:covered-history',
      historicallySeenIds,
    });
    const second = selectQuestionsFromRandomCycle({
      questions,
      count: 2,
      storageKey: 'cycle:covered-history',
      historicallySeenIds,
    });

    expect(new Set([...first, ...second].map((question) => question.id)).size).toBe(6);
  });

  it('devuelve al ciclo las preguntas cargadas en un test pero todavía no visualizadas', () => {
    const questions = makeQuestions(7);
    const first = selectQuestionsFromRandomCycle({
      questions,
      count: 3,
      storageKey: 'cycle:abandoned',
      historicallySeenIds: [],
    });
    const onlyViewedId = first[0].id;
    const notReachedIds = first.slice(1).map((question) => question.id);

    const subsequent = selectQuestionsFromRandomCycle({
      questions,
      count: 6,
      storageKey: 'cycle:abandoned',
      historicallySeenIds: [onlyViewedId],
    });

    expect(subsequent.map((question) => question.id)).not.toContain(onlyViewedId);
    expect(subsequent.map((question) => question.id)).toEqual(expect.arrayContaining(notReachedIds));
    expect(new Set(subsequent.map((question) => question.id)).size).toBe(6);
  });
});
