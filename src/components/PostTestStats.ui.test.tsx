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
});

