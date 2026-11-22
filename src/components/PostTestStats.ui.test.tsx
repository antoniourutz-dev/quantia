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
        category: 'Ley 39/2015',
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

    // "Por ley" and "Tiempo" always rendered even in standard mode
    expect(screen.getByText('Por ley')).toBeInTheDocument();
    expect(screen.getByText('Tiempo')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('distingue preguntas en blanco de fallos en resumen, métricas y revisión', async () => {
    const questions: Question[] = [
      {
        id: 'q1',
        number: 1,
        text: 'Pregunta acertada',
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

    expect(screen.getByText('1 bien · 1 mal · 1 en blanco')).toBeInTheDocument();
    expect(screen.getByText('En blanco')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Analizar 1 fallo' }));
    expect(screen.getByText('Pregunta fallada')).toBeInTheDocument();
    expect(screen.getByText('FALLO')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Pregunta dejada en blanco')).toBeInTheDocument();
    expect(screen.getByText('EN BLANCO')).toBeInTheDocument();
    expect(screen.getByText('Dejaste esta pregunta sin responder.')).toBeInTheDocument();
  });
});
