import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestInterface from './TestInterface';
import type { Question } from '../types';

const sampleQuestions: Question[] = [
  {
    id: 'q1',
    number: 1,
    text: 'Primera pregunta del examen',
    options: [
      { id: 'a', text: 'Opción A1' },
      { id: 'b', text: 'Opción B1' },
      { id: 'c', text: 'Opción C1' },
      { id: 'd', text: 'Opción D1' },
    ],
    correctAnswer: 'a',
    explanation: 'Explicación detallada de la pregunta 1.',
    syllabus: 'common',
    category: 'Ley 39/2015',
    questionScope: 'common',
  },
  {
    id: 'q2',
    number: 2,
    text: 'Segunda pregunta del examen',
    options: [
      { id: 'a', text: 'Opción A2' },
      { id: 'b', text: 'Opción B2' },
      { id: 'c', text: 'Opción C2' },
      { id: 'd', text: 'Opción D2' },
    ],
    correctAnswer: 'b',
    explanation: 'Explicación detallada de la pregunta 2.',
    syllabus: 'common',
    category: 'Ley 40/2015',
    questionScope: 'common',
  },
  {
    id: 'q3',
    number: 3,
    text: 'Tercera pregunta del examen',
    options: [
      { id: 'a', text: 'Opción A3' },
      { id: 'b', text: 'Opción B3' },
      { id: 'c', text: 'Opción C3' },
      { id: 'd', text: 'Opción D3' },
    ],
    correctAnswer: 'c',
    explanation: 'Explicación detallada de la pregunta 3.',
    syllabus: 'specific',
    category: 'Estatuto Marco',
    questionScope: 'specific',
  },
];

describe('TestInterface', () => {
  it('permite dejar preguntas en blanco/saltar y omite las no contestadas en onFinish', async () => {
    window.scrollTo = vi.fn();
    const onFinish = vi.fn();
    const user = userEvent.setup();

    render(
      <TestInterface
        questions={sampleQuestions}
        mode="standard"
        onFinish={onFinish}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText('Primera pregunta del examen')).toBeInTheDocument();

    // Skip Q1 using the desktop "Dejar en blanco" button
    const skipButtons = screen.getAllByRole('button', { name: /Dejar en blanco/i });
    await user.click(skipButtons[0]);

    // Answer Q2 correctly (Option B)
    expect(screen.getByText('Segunda pregunta del examen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Opción B2/i }));
    const nextButtons = screen.getAllByRole('button', { name: /Siguiente/i });
    await user.click(nextButtons[0]);

    // Leave Q3 blank and finish directly
    expect(screen.getByText('Tercera pregunta del examen')).toBeInTheDocument();
    const finishButtons = screen.getAllByRole('button', { name: /^Finalizar$/i });
    await user.click(finishButtons[0]);

    expect(onFinish).toHaveBeenCalledTimes(1);
    const payload = onFinish.mock.calls[0][0];
    expect(payload.score).toBe(1);
    expect(payload.answers).toHaveLength(1);
    expect(payload.answers[0]).toEqual(
      expect.objectContaining({
        questionId: 'q2',
        selectedOption: 'b',
        correctOption: 'b',
        isCorrect: true,
      }),
    );
  });

  it('permite borrar la respuesta seleccionada en modo simulacro', async () => {
    window.scrollTo = vi.fn();
    const onFinish = vi.fn();
    const user = userEvent.setup();

    render(
      <TestInterface
        questions={sampleQuestions}
        mode="simulacro"
        onFinish={onFinish}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText('0/3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Opción A1/i }));
    expect(screen.getByText('1/3')).toBeInTheDocument();

    // Clear answer using "Borrar respuesta" button
    await user.click(screen.getByRole('button', { name: /Borrar respuesta/i }));
    expect(screen.getByText('0/3')).toBeInTheDocument();

    // Select again and unselect by clicking the same option in simulacro
    await user.click(screen.getByRole('button', { name: /Opción A1/i }));
    expect(screen.getByText('1/3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Opción A1/i }));
    expect(screen.getByText('0/3')).toBeInTheDocument();
  });

  it('permite marcar bandera de duda y saltar a cualquier pregunta desde el mapa rápido', async () => {
    window.scrollTo = vi.fn();
    const user = userEvent.setup();

    render(
      <TestInterface
        questions={sampleQuestions}
        mode="standard"
        onFinish={() => undefined}
        onCancel={() => undefined}
      />,
    );

    const doubtBtn = screen.getByRole('button', { name: /^Duda$/i });
    expect(doubtBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(doubtBtn);
    expect(screen.getByRole('button', { name: /En duda/i })).toHaveAttribute('aria-pressed', 'true');

    const gridToggle = screen.getByRole('button', { name: /Mapa de preguntas/i });
    await user.click(gridToggle);

    expect(screen.getByText('Contestadas: 0')).toBeInTheDocument();
    expect(screen.getByText('En blanco: 3')).toBeInTheDocument();
    expect(screen.getByText('Con duda: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pregunta 3' }));
    expect(screen.getByText('Tercera pregunta del examen')).toBeInTheDocument();
  });

  it('soporta atajos de teclado (A-D, 1-4, flechas, E para explicación) y respeta foco en inputs', () => {
    window.scrollTo = vi.fn();

    render(
      <div>
        <input aria-label="Campo externo" />
        <TestInterface
          questions={sampleQuestions}
          mode="standard"
          onFinish={() => undefined}
          onCancel={() => undefined}
        />
      </div>,
    );

    // Guardrail: typing inside an input should not trigger shortcuts
    const externalInput = screen.getByLabelText('Campo externo');
    externalInput.focus();
    fireEvent.keyDown(externalInput, { key: 'a' });
    fireEvent.keyDown(externalInput, { key: 'ArrowRight' });
    expect(screen.getByText('Primera pregunta del examen')).toBeInTheDocument();
    expect(screen.queryByText('✓ Correcto')).not.toBeInTheDocument();

    // Blur input and press 'a' to select Option A on Q1
    externalInput.blur();
    fireEvent.keyDown(window, { key: 'a' });
    expect(screen.getByText('✓ Correcto')).toBeInTheDocument();

    // Press 'e' to toggle explanation open and close
    expect(screen.queryByText('Explicación detallada de la pregunta 1.')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'e' });
    expect(screen.getByText('Explicación detallada de la pregunta 1.')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'e' });
    expect(screen.queryByText('Explicación detallada de la pregunta 1.')).not.toBeInTheDocument();

    // Press ArrowRight to advance to Q2, then '2' to select Option B on Q2
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Segunda pregunta del examen')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByText('✓ Correcto')).toBeInTheDocument();

    // Press ArrowLeft to return to Q1
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Primera pregunta del examen')).toBeInTheDocument();
  });
});
