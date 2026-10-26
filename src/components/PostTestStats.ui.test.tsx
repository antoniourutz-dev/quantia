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
});
