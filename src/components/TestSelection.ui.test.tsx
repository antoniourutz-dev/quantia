import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../lib/locale';
import TestSelection, { type TestSelectionStateSnapshot } from './TestSelection';

const createBaseProps = () => ({
  curriculum: 'osakidetza',
  lawOptions: [],
  initialSyllabus: null,
  onStart: vi.fn(),
  onStartChallenge: vi.fn(),
  onStartLawTest: vi.fn(),
  onStartCustomTest: vi.fn(),
  onStartCustomPractice: vi.fn(),
});

describe('TestSelection', () => {
  it('muestra exactamente los 6 modos consolidados (sin Bloque corto) y los presets [5, 10, 20, 50] con badge Rápido en standard', () => {
    const props = createBaseProps();

    render(
      <LocaleProvider locale="es">
        <TestSelection {...props} />
      </LocaleProvider>,
    );

    expect(screen.getByRole('button', { name: /Test por temario/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Corregir fallos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Temas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simulacro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Desafío/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A tu medida/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bloque corto/i })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /5\s*Rápido/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument();

    // No duplicate numeric range controls inside standard
    expect(screen.queryByRole('button', { name: /Rango/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Desde/i)).not.toBeInTheDocument();
  });

  it('lanza quick_five al elegir 5 preguntas en Mixto, y standard con temario al elegir 5 en Común', () => {
    const props = createBaseProps();

    render(
      <LocaleProvider locale="es">
        <TestSelection {...props} />
      </LocaleProvider>,
    );

    // Default syllabus is 'common' -> 5 questions calls onStart('standard', 'common', 5)
    fireEvent.click(screen.getByRole('button', { name: /5\s*Rápido/i }));
    fireEvent.click(screen.getByRole('button', { name: /Empezar bloque rápido/i }));
    expect(props.onStart).toHaveBeenLastCalledWith('standard', 'common', 5);

    // Switch syllabus to 'mixed' -> 5 questions calls onStart('quick_five', undefined, 5)
    fireEvent.click(screen.getByRole('button', { name: /^Mixto$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Empezar bloque rápido/i }));
    expect(props.onStart).toHaveBeenLastCalledWith('quick_five', undefined, 5);
  });

  it('mantiene el rango numérico exclusivamente en A tu medida y usa Hasieratik en euskera', () => {
    const props = {
      ...createBaseProps(),
      curriculum: 'goi-teknikaria',
    };

    render(
      <LocaleProvider locale="eu">
        <TestSelection {...props} />
      </LocaleProvider>,
    );

    // In standard mode (EU), badge says Azkarra and there is no range input
    expect(screen.getByRole('button', { name: /5\s*Azkarra/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Hasieratik')).not.toBeInTheDocument();

    // Switch to custom ("Zure neurrira")
    fireEvent.click(screen.getByRole('button', { name: /Zure neurrira/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tartea \(aukerakoa\)/i }));

    const fromInput = screen.getByPlaceholderText('Hasieratik');
    expect(fromInput).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Desde')).not.toBeInTheDocument();

    fireEvent.change(fromInput, { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Amaiera (auk.)'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Test pertsonalizatua hasi/i }));

    expect(props.onStartCustomTest).toHaveBeenCalledWith({
      from: 10,
      to: 25,
      randomize: false,
      syllabus: null,
    });
  });

  it('convierte un snapshot legado con selectionMode="quick" a standard con 5 preguntas', () => {
    const props = createBaseProps();
    const legacyState: TestSelectionStateSnapshot = {
      selectionMode: 'quick',
      selectedSyllabus: 'mixed',
      selectedLaw: '',
      questionCount: 20,
      simulacroScope: 'mixed',
      simulacroCount: 50,
      customFrom: '',
      customTo: '',
      customOrder: 'sequence',
      customContentScope: 'common_and_specific',
      customTopicMode: 'all',
      customTopic: '',
      customSessionLength: 50,
      customShowMarks: false,
      customShowNotes: false,
    };

    render(
      <LocaleProvider locale="es">
        <TestSelection {...props} initialState={legacyState} />
      </LocaleProvider>,
    );

    expect(screen.getByRole('button', { name: /Test por temario/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /5\s*Rápido/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Empezar bloque rápido/i }));
    expect(props.onStart).toHaveBeenCalledWith('quick_five', undefined, 5);
  });
});
