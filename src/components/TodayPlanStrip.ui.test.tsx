import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TodayPlanStrip from './TodayPlanStrip';

describe('TodayPlanStrip', () => {
  it('renderiza en español con racha > 0, metadatos de sesión y dispara onStartPlan en 1 clic', () => {
    const onStartPlan = vi.fn();

    render(
      <TodayPlanStrip
        streakDays={5}
        hydrated
        eyebrow="Tu plan de hoy"
        title="Consolida tus fallos recientes"
        subtitle="Un bloque enfocado te devuelve el ritmo sin saturarte."
        sessionMetaLabel="20 preg. · ~20 min"
        ctaLabel="Empezar sesión"
        tone="build"
        locale="es"
        onStartPlan={onStartPlan}
      />,
    );

    const strip = screen.getByTestId('today-plan-strip');
    expect(strip).toHaveAttribute('data-hydrated', 'true');
    expect(strip).toHaveAttribute('data-tone', 'build');
    expect(screen.getByText('Tu plan de hoy')).toBeInTheDocument();
    expect(screen.getByTestId('today-plan-streak')).toHaveTextContent('5 días');
    expect(screen.getByTestId('today-plan-session-meta')).toHaveTextContent('20 preg. · ~20 min');
    expect(screen.getByText('Consolida tus fallos recientes')).toBeInTheDocument();
    expect(screen.getByText('Un bloque enfocado te devuelve el ritmo sin saturarte.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Empezar sesión/i }));
    expect(onStartPlan).toHaveBeenCalledTimes(1);
  });

  it('muestra mensaje cálido en español cuando la racha es 0 y usa singular para 1 día', () => {
    const { rerender } = render(
      <TodayPlanStrip
        streakDays={0}
        hydrated
        eyebrow="Tu plan de hoy"
        title="Arranca tu primera sesión"
        ctaLabel="Practicar ahora"
        locale="es"
        onStartPlan={vi.fn()}
      />,
    );

    expect(screen.getByTestId('today-plan-streak')).toHaveTextContent('0 días · Empieza hoy');

    rerender(
      <TodayPlanStrip
        streakDays={1}
        hydrated
        eyebrow="Tu plan de hoy"
        title="Mantén la racha"
        ctaLabel="Practicar ahora"
        locale="es"
        onStartPlan={vi.fn()}
      />,
    );

    expect(screen.getByTestId('today-plan-streak')).toHaveTextContent('1 día');
  });

  it('renderiza correctamente en euskera (racha 0 y > 0)', () => {
    const { rerender } = render(
      <TodayPlanStrip
        streakDays={0}
        hydrated
        eyebrow="Zure gaurko plana"
        title="Hasi gaurko saioa"
        sessionMetaLabel="10 gald. · ~12 min"
        ctaLabel="Saioa hasi"
        tone="rescue"
        locale="eu"
        onStartPlan={vi.fn()}
      />,
    );

    expect(screen.getByText('Zure gaurko plana')).toBeInTheDocument();
    expect(screen.getByTestId('today-plan-streak')).toHaveTextContent('0 egun · Hasi gaur');
    expect(screen.getByTestId('today-plan-session-meta')).toHaveTextContent('10 gald. · ~12 min');

    rerender(
      <TodayPlanStrip
        streakDays={3}
        hydrated
        eyebrow="Zure gaurko plana"
        title="Jarraitu erritmo onean"
        ctaLabel="Saioa hasi"
        tone="push"
        locale="eu"
        onStartPlan={vi.fn()}
      />,
    );

    expect(screen.getByTestId('today-plan-streak')).toHaveTextContent('3 egun');
  });

  it('respeta los estados disabled y no hidratado', () => {
    const onStartPlan = vi.fn();

    render(
      <TodayPlanStrip
        streakDays={0}
        hydrated={false}
        disabled
        eyebrow="Tu plan de hoy"
        title="Preparando tu recomendación"
        ctaLabel="Practicar ahora"
        onStartPlan={onStartPlan}
      />,
    );

    expect(screen.getByTestId('today-plan-strip')).toHaveAttribute('data-hydrated', 'false');
    const button = screen.getByRole('button', { name: /Practicar ahora/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onStartPlan).not.toHaveBeenCalled();
  });
});
