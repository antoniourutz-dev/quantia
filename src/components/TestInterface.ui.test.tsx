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


  it('protege respuestas introducidas y permite continuar tras Escape', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<TestInterface {...props} mode="simulacro" />);

    await user.click(screen.getByRole('button', { name: /Opción A/i }));
    await user.click(screen.getByRole('button', { name: 'Salir' }));

    const dialog = screen.getByRole('alertdialog', { name: '¿Quieres abandonar el test?' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Has respondido 1 preguntas');
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Seguir con el test' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(props.onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Salir' }));
    await user.click(screen.getByRole('button', { name: 'Salir sin guardar' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('sale directamente cuando la primera pregunta sigue vacía', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<TestInterface {...props} mode="standard" />);
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('mantiene el tiempo real del simulacro tras ocultar y reabrir la pestaña', () => {
    const now = vi.spyOn(Date, 'now');
    const start = 1_780_000_000_000;
    now.mockReturnValue(start);
    try {
      render(<TestInterface {...createProps()} mode="simulacro" />);
      expect(screen.getByText('3:00')).toBeInTheDocument();
      now.mockReturnValue(start + 52_000);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(screen.getByText('2:08')).toBeInTheDocument();
    } finally {
      now.mockRestore();
    }
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
