import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HighlightableText from './HighlightableText';
import { LocaleProvider } from '../lib/locale';

describe('HighlightableText', () => {
  it('elimina un resaltado con confirmación in-situ sin invocar window.confirm (ES y EU)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const onRemoveHighlight = vi.fn();
    const user = userEvent.setup();

    const { unmount } = render(
      <LocaleProvider locale="es">
        <HighlightableText
          text="El plazo de recurso de alzada es de un mes."
          highlights={[
            {
              id: 'hl-1',
              startIndex: 36,
              endIndex: 42,
              type: 'deadline',
            },
          ]}
          onAddHighlight={() => undefined}
          onRemoveHighlight={onRemoveHighlight}
        />
      </LocaleProvider>,
    );

    await user.click(screen.getByText('un mes'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText('¿Eliminar resaltado?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('¿Eliminar resaltado?')).not.toBeInTheDocument();
    expect(onRemoveHighlight).not.toHaveBeenCalled();

    await user.click(screen.getByText('un mes'));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onRemoveHighlight).toHaveBeenCalledWith('hl-1');
    expect(confirmSpy).not.toHaveBeenCalled();

    unmount();

    render(
      <LocaleProvider locale="eu">
        <HighlightableText
          text="Gora jotzeko errekurtsoaren epea hilabetekoa da."
          highlights={[
            {
              id: 'hl-eu',
              startIndex: 33,
              endIndex: 44,
              type: 'deadline',
            },
          ]}
          onAddHighlight={() => undefined}
          onRemoveHighlight={onRemoveHighlight}
        />
      </LocaleProvider>,
    );

    await user.click(screen.getByText('hilabetekoa'));
    expect(screen.getByText('Nabarmendua kendu?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kendu' }));
    expect(onRemoveHighlight).toHaveBeenCalledWith('hl-eu');
    confirmSpy.mockRestore();
  });

  it('muestra etiquetas localizadas en español y euskera en la barra de selección', () => {
    const onAddHighlight = vi.fn();

    const { container, unmount } = render(
      <LocaleProvider locale="es">
        <HighlightableText
          text="Texto normativo de prueba"
          highlights={[]}
          onAddHighlight={onAddHighlight}
          onRemoveHighlight={() => undefined}
        />
      </LocaleProvider>,
    );

    const textNode = container.querySelector('.highlightable-text')?.firstChild?.firstChild;
    expect(textNode).toBeTruthy();

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      anchorNode: textNode,
      focusNode: textNode,
      anchorOffset: 0,
      focusOffset: 5,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ top: 100, left: 100, width: 40, height: 20 }),
      }),
      removeAllRanges: vi.fn(),
    } as unknown as Selection);

    fireEvent(document, new Event('selectionchange'));

    expect(screen.getByText('Clave')).toBeInTheDocument();
    expect(screen.getByText('Ley')).toBeInTheDocument();
    expect(screen.getByText('Plazo')).toBeInTheDocument();
    expect(screen.getByText('Excep.')).toBeInTheDocument();
    expect(screen.queryByText('Key')).not.toBeInTheDocument();

    unmount();

    const { container: euContainer } = render(
      <LocaleProvider locale="eu">
        <HighlightableText
          text="Arau testua"
          highlights={[]}
          onAddHighlight={onAddHighlight}
          onRemoveHighlight={() => undefined}
        />
      </LocaleProvider>,
    );

    const euTextNode = euContainer.querySelector('.highlightable-text')?.firstChild?.firstChild;
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      anchorNode: euTextNode,
      focusNode: euTextNode,
      anchorOffset: 0,
      focusOffset: 4,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ top: 100, left: 100, width: 40, height: 20 }),
      }),
      removeAllRanges: vi.fn(),
    } as unknown as Selection);

    fireEvent(document, new Event('selectionchange'));

    expect(screen.getByText('Gakoa')).toBeInTheDocument();
    expect(screen.getByText('Legea')).toBeInTheDocument();
    expect(screen.getByText('Epea')).toBeInTheDocument();
    expect(screen.getByText('Salb.')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
