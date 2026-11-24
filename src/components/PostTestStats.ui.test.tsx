import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostTestStats from './PostTestStats';
import type { FinishedTestPayload, PracticeMode, Question } from '../types';

describe('PostTestStats', () => {
  it('CTA home vuelve a test (onGoHome)', async () => {
    const onGoHome = vi.fn();

    const payload = {
      score: 1,
      answers: [
        {
          questionId: 'q1',
          selectedOption: 'a',
          correctOption: 'a',
          isCorrect: true,
          answeredAt: '2020-01-01T00:00:00.000Z',
          responseTimeMs: 1000,
          timeToFirstSelectionMs: null,
          changedAnswer: false,
        },
      ],
    } as unknown as FinishedTestPayload;

    const questions = [
      {
        id: 'q1',
        number: 1,
        text: 'Pregunta de ejemplo',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
          { id: 'd', text: 'D' },
        ],
        correctAnswer: 'a',
        explanation: 'explicacion',
        syllabus: 'common',
        category: null,
        questionScope: null,
      },
    ] as unknown as Question[];

    const user = userEvent.setup();

    render(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode={'standard' as PracticeMode}
        curriculum="osakidetza_admin"
        onRestart={() => undefined}
        onGoBack={() => undefined}
        onGoHome={onGoHome}
        homeVariant="test-selection"
      />,
    );

    const homeButton = screen.getByRole('button', { name: /Volver a test/i });
    await user.click(homeButton);

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('permite analizar los fallos uno a uno en cualquier modalidad', async () => {
    const questions = ['q1', 'q2'].map((id, index) => ({
      id,
      number: index + 1,
      text: `Pregunta fallada ${index + 1}`,
      options: [
        { id: 'a', text: `Incorrecta ${index + 1}` },
        { id: 'b', text: `Correcta ${index + 1}` },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ],
      correctAnswer: 'b',
      explanation: `Explicación ${index + 1}`,
      syllabus: 'specific',
      category: 'Tema',
      questionScope: 'specific',
    })) as unknown as Question[];
    const payload = {
      score: 0,
      answers: questions.map((question) => ({
        questionId: question.id,
        selectedOption: 'a',
        correctOption: 'b',
        isCorrect: false,
        answeredAt: '2026-10-26T10:00:00.000Z',
        responseTimeMs: 1000,
        timeToFirstSelectionMs: 1000,
        changedAnswer: false,
      })),
    } as FinishedTestPayload;
    const user = userEvent.setup();

    render(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="custom"
        curriculum="osakidetza_electromedicina"
        onRestart={() => undefined}
        onGoBack={() => undefined}
        onGoHome={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Analizar 2 fallos' }));
    expect(screen.getByText('Pregunta fallada 1')).toBeInTheDocument();
    expect(screen.queryByText('Pregunta fallada 2')).not.toBeInTheDocument();
    expect(screen.getByText('Incorrecta 1')).toBeInTheDocument();
    expect(screen.getByText('Correcta 1')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('Tu respuesta')).toBeInTheDocument();
    expect(screen.getByText('Respuesta correcta')).toBeInTheDocument();
    expect(screen.queryByText('Explicación 1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver explicación' }));
    expect(screen.getByText('Explicación 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Pregunta fallada 2')).toBeInTheDocument();
    expect(screen.queryByText('Pregunta fallada 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Explicación 2')).not.toBeInTheDocument();
  });

  it('renderiza headline, summary, microReward, continuityLine y desglose Por ley en modos no-simulacro', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const store = new Map<string, string>([
      [
        'quantia.session_close.v1',
        JSON.stringify({
          timestamp: yesterday.toISOString(),
          curriculum: 'osakidetza_operario',
          mode: 'standard',
          dominantState: 'momentum_up',
          thesis: 'Buen cierre previo.',
          nextCta: 'Hacer otro test',
          score: 8,
          total: 10,
        }),
      ],
    ]);
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });

    const questions: Question[] = [
      {
        id: 'q1',
        number: 1,
        text: 'Pregunta Ley 1',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
          { id: 'd', text: 'D' },
        ],
        correctAnswer: 'a',
        explanation: 'Exp 1',
        syllabus: 'common',
        category: 'Ley 39/2015',
        questionScope: 'common',
      },
      {
        id: 'q2',
        number: 2,
        text: 'Pregunta Ley 2',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
          { id: 'd', text: 'D' },
        ],
        correctAnswer: 'b',
        explanation: 'Exp 2',
        syllabus: 'common',
        category: 'Ley 40/2015',
        questionScope: 'common',
      },
    ];

    const payload: FinishedTestPayload = {
      score: 2,
      answers: [
        {
          questionId: 'q1',
          selectedOption: 'a',
          correctOption: 'a',
          isCorrect: true,
          answeredAt: '2026-10-26T10:00:00.000Z',
          responseTimeMs: 4000,
          timeToFirstSelectionMs: 4000,
          changedAnswer: false,
        },
        {
          questionId: 'q2',
          selectedOption: 'b',
          correctOption: 'b',
          isCorrect: true,
          answeredAt: '2026-10-26T10:00:05.000Z',
          responseTimeMs: 6000,
          timeToFirstSelectionMs: 6000,
          changedAnswer: false,
        },
      ],
    };

    render(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="osakidetza_operario"
        onRestart={() => undefined}
        onGoBack={() => undefined}
        onGoHome={() => undefined}
      />,
    );

    // Continuity line from yesterday
    expect(screen.getByText(/Ayer: Buen cierre previo\. Hoy: Hacer otro test\./i)).toBeInTheDocument();
    // SessionEnd headline & microReward (didReturnAfterGap triggers 'Bien por aparecer hoy' when roll passes)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Bien por aparecer hoy')).toBeInTheDocument();
    expect(screen.getByText('Eso es lo que hace que el progreso se quede.')).toBeInTheDocument();

    // "Por tema / ley" renders when >=2 topics/laws, and redundant "Tiempo" card is gone
    expect(screen.getByText('Por tema / ley')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tiempo' })).not.toBeInTheDocument();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('distingue fallos, preguntas en blanco y dudas en métricas y pestañas de revisión', async () => {
    const questions: Question[] = [
      {
        id: 'q1',
        number: 1,
        text: 'Pregunta acertada con duda',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctAnswer: 'a',
        explanation: 'Exp 1',
        syllabus: 'common',
        category: 'Tema 1',
        questionScope: 'common',
      },
      {
        id: 'q2',
        number: 2,
        text: 'Pregunta fallada',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctAnswer: 'b',
        explanation: 'Exp 2',
        syllabus: 'common',
        category: 'Tema 1',
        questionScope: 'common',
      },
      {
        id: 'q3',
        number: 3,
        text: 'Pregunta dejada en blanco',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctAnswer: 'a',
        explanation: 'Exp 3',
        syllabus: 'common',
        category: 'Tema 1',
        questionScope: 'common',
      },
    ];

    const payload: FinishedTestPayload = {
      score: 1,
      flaggedQuestionIds: ['q1', 'q3'],
      answers: [
        {
          questionId: 'q1',
          selectedOption: 'a',
          correctOption: 'a',
          isCorrect: true,
          answeredAt: '2026-10-26T10:00:00.000Z',
          responseTimeMs: 4000,
          timeToFirstSelectionMs: 4000,
          changedAnswer: false,
        },
        {
          questionId: 'q2',
          selectedOption: 'a',
          correctOption: 'b',
          isCorrect: false,
          answeredAt: '2026-10-26T10:00:06.000Z',
          responseTimeMs: 6000,
          timeToFirstSelectionMs: 6000,
          changedAnswer: false,
        },
      ],
    };

    const user = userEvent.setup();

    render(
      <PostTestStats
        payload={payload}
        questions={questions}
        mode="standard"
        curriculum="osakidetza_admin"
        onRestart={() => undefined}
        onGoBack={() => undefined}
        onGoHome={() => undefined}
      />,
    );

    // Single-topic test hides redundant "Por tema / ley" card
    expect(screen.queryByText('Por tema / ley')).not.toBeInTheDocument();
    expect(screen.getByText('En blanco')).toBeInTheDocument();
    expect(screen.getByText('Dudas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Revisar test \(1 fallo · 1 en blanco · 2 dudas\)/i }));
    expect(screen.getByText('Pregunta fallada')).toBeInTheDocument();
    expect(screen.getByText('FALLO')).toBeInTheDocument();

    // Switch to "En blanco (1)" tab
    await user.click(screen.getByRole('tab', { name: /En blanco \(1\)/i }));
    expect(screen.getByText('Pregunta dejada en blanco')).toBeInTheDocument();
    expect(screen.getByText('EN BLANCO')).toBeInTheDocument();
    expect(screen.getByText('DUDA')).toBeInTheDocument();
    expect(screen.getByText('Dejaste esta pregunta sin responder.')).toBeInTheDocument();

    // Switch to "Con duda (2)" tab
    await user.click(screen.getByRole('tab', { name: /Con duda \(2\)/i }));
    expect(screen.getByText('Pregunta acertada con duda')).toBeInTheDocument();
    expect(screen.getByText('DUDA')).toBeInTheDocument();
  });

  it('muestra Nota Neta /10, pérdida por penalización frente a blancos y nota neta por ley con -0,25', () => {
    const questions: Question[] = Array.from({ length: 10 }, (_, idx) => ({
      id: `q${idx + 1}`,
      number: idx + 1,
      text: `Pregunta ${idx + 1}`,
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctAnswer: 'a',
      explanation: `Exp ${idx + 1}`,
      syllabus: 'common',
      category: idx < 5 ? 'Ley 39/2015' : 'Ley 40/2015',
      questionScope: 'common',
    }));

    // 5 correct (4 in Ley 39, 1 in Ley 40), 4 incorrect (1 in Ley 39, 3 in Ley 40), 1 blank (Ley 40)
    const answers = [
      ...['q1', 'q2', 'q3', 'q4', 'q6'].map((id) => ({
        questionId: id,
        selectedOption: 'a',
        correctOption: 'a',
        isCorrect: true,
        answeredAt: '2026-10-26T10:00:00.000Z',
        responseTimeMs: 3000,
        timeToFirstSelectionMs: 3000,
        changedAnswer: false,
      })),
      ...['q5', 'q7', 'q8', 'q9'].map((id) => ({
        questionId: id,
        selectedOption: 'b',
        correctOption: 'a',
        isCorrect: false,
        answeredAt: '2026-10-26T10:00:05.000Z',
        responseTimeMs: 3000,
        timeToFirstSelectionMs: 3000,
        changedAnswer: false,
      })),
    ];

    render(
      <PostTestStats
        payload={{ score: 5, answers }}
        questions={questions}
        mode="simulacro"
        curriculum="osakidetza_admin"
        penaltyRule="quarter"
        onRestart={() => undefined}
        onGoBack={() => undefined}
        onGoHome={() => undefined}
      />,
    );

    // 5 - 4 * 0.25 = 4.00 / 10 -> 4,00/10
    expect(screen.getByText('Nota neta')).toBeInTheDocument();
    expect(screen.getByText('-0,25')).toBeInTheDocument();
    expect(screen.getByText('4,00/10')).toBeInTheDocument();
    expect(screen.getByText(/-1,00 pts \(-1,00\/10\) por 4 fallos/i)).toBeInTheDocument();
    expect(screen.getByText(/1 en blanco sin penalización \(0 pts\)/i)).toBeInTheDocument();
    // Per-law net scores: Ley 39 (4 - 0.25 = 3.75/5 = 7,50/10), Ley 40 (1 - 0.75 = 0.25/5 = 0,50/10)
    expect(screen.getByText('7,50/10')).toBeInTheDocument();
    expect(screen.getByText('0,50/10')).toBeInTheDocument();
  });

  it('calcula exactamente -1,00 pt por 3 fallos con regla -0,33 (1/3 exacto)', () => {
    const questions: Question[] = Array.from({ length: 10 }, (_, idx) => ({
      id: `q${idx + 1}`,
      number: idx + 1,
      text: `Pregunta ${idx + 1}`,
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctAnswer: 'a',
      explanation: `Exp ${idx + 1}`,
      syllabus: 'common',
      category: 'Tema 1',
      questionScope: 'common',
    }));

    const answers = [
      ...questions.slice(0, 7).map((q) => ({
        questionId: q.id,
        selectedOption: 'a',
        correctOption: 'a',
        isCorrect: true,
        answeredAt: '2026-10-26T10:00:00.000Z',
        responseTimeMs: 2500,
        timeToFirstSelectionMs: 2500,
        changedAnswer: false,
      })),
      ...questions.slice(7).map((q) => ({
        questionId: q.id,
        selectedOption: 'b',
        correctOption: 'a',
        isCorrect: false,
        answeredAt: '2026-10-26T10:00:05.000Z',
        responseTimeMs: 2500,
        timeToFirstSelectionMs: 2500,
        changedAnswer: false,
      })),
    ];

    render(
      <PostTestStats
        payload={{ score: 7, answers }}
        questions={questions}
        mode="standard"
        curriculum="osakidetza_admin"
        penaltyRule="third"
        onRestart={() => undefined}
        onGoBack={() => undefined}
        onGoHome={() => undefined}
      />,
    );

    expect(screen.getByText('-0,33')).toBeInTheDocument();
    expect(screen.getByText('6,00/10')).toBeInTheDocument();
    expect(screen.getByText(/-1,00 pts \(-1,00\/10\) por 3 fallos/i)).toBeInTheDocument();
  });
});

