import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestInterface from './TestInterface';
import type { Question, FinishedTestPayload } from '../types';

const questions: Question[] = [1, 2].map((number) => ({
  id: `q-${number}`,
  number,
  text: `Pregunta de simulacro ${number}`,
  options: [
    { id: 'a', text: 'Opción A' },
    { id: 'b', text: 'Opción B' },
  ],
  correctAnswer: 'b',
  explanation: 'Por qué es correcta',
  syllabus: 'specific',
  category: 'Tema 1',
  questionScope: 'specific',
}));

const createProps = () => ({
  questions,
  onFinish: vi.fn<(payload: FinishedTestPayload) => void>(),
  onCancel: vi.fn(),
});

describe('TestInterface: accesibilidad y flujo del examen', () => {
  it('permite saltar preguntas sin responder en un simulacro y volver a ellas', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<TestInterface {...props} mode="simulacro" />);

    expect(screen.getByRole('progressbar', { name: 'Progreso del test' })).toHaveAttribute('aria-valuenow', '1');
    const skipButtons = screen.getAllByRole('button', { name: 'Pasar sin responder' });
    expect(skipButtons).toHaveLength(2);
    expect(skipButtons[0]).toBeEnabled();
    await user.click(skipButtons[0]);

    expect(screen.getByText('Pregunta de simulacro 2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progreso del test' })).toHaveAttribute('aria-valuenow', '2');
    expect(props.onFinish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Pregunta anterior' }));
    expect(screen.getByText('Pregunta de simulacro 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Pasar sin responder' })[0]).toBeEnabled();
  });

  it('no permite pasar sin contestar en el entrenamiento guiado', () => {
    render(<TestInterface {...createProps()} mode="standard" />);
    expect(screen.queryByRole('button', { name: 'Pasar sin responder' })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progreso del test' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Pregunta de simulacro 1')).toBeInTheDocument();
  });

  it('permite entrar y salir de concentración también desde la cabecera móvil', async () => {
    const user = userEvent.setup();
    render(<TestInterface {...createProps()} mode="simulacro" />);
    await user.click(screen.getByRole('button', { name: 'Concentración' }));
    expect(screen.getByRole('button', { name: 'Salir de concentración' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salir de concentración' }));
    expect(screen.getByRole('button', { name: 'Concentración' })).toBeInTheDocument();
  });
});
