import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminQuestions from './AdminQuestions';
import type { AdminQuestionDetail } from '../../types';
import type { EditorExitGuard } from './useEditorSafety';
import * as api from '../../lib/quantiaApi';

vi.mock('../../lib/quantiaApi', () => ({
  adminCreateQuestion: vi.fn(), adminUpdateQuestion: vi.fn(),
  adminListQuestions: vi.fn(), adminGetQuestionDetail: vi.fn(),
  adminFindAdjacentQuestionId: vi.fn(), adminResolveOppositionConfigByOppositionId: vi.fn(),
}));

const detail = {
  id: 'q1', oppositionId: '11111111-1111-4111-8111-111111111111',
  curriculum: 'test', curriculumKey: 'key', syllabus: 'common', number: 1,
  text: 'Pregunta original', correctAnswer: 'a', languageCode: 'es',
  options: [{ id: 'a', text: 'Uno' }, { id: 'b', text: 'Dos' }],
  explanation: 'Explicación original',
} as AdminQuestionDetail;

function setup() {
  const onClose = vi.fn();
  const exitGuard: EditorExitGuard = { current: null };
  render(<AdminQuestions curriculumOptions={[{ id: 'test', label: 'Test' }]} defaultCurriculum="test" onClose={onClose} exitGuard={exitGuard} />);
  return { user: userEvent.setup(), onClose, exitGuard };
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Aplicar' }));
  await user.click(await screen.findByRole('button', { name: /Pregunta original/ }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('Pregunta original'));
}

beforeEach(() => {
  vi.resetAllMocks();
  // jsdom does not implement modal dialog methods; browser keyboard/focus QA remains separate.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector<HTMLButtonElement>('button')?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.mocked(api.adminListQuestions).mockResolvedValue({ items: [detail], hasNextPage: false, page: 1, pageSize: 50, total: 1 });
  vi.mocked(api.adminGetQuestionDetail).mockResolvedValue(detail);
  vi.mocked(api.adminResolveOppositionConfigByOppositionId).mockResolvedValue({ curriculum: 'test', curriculumKey: 'key' });
});

describe('AdminQuestions: conservación y guardado', () => {
  it('confirma selección de otra ficha y la carga solo tras aceptar', async () => {
    const { user } = setup();
    vi.mocked(api.adminListQuestions).mockResolvedValue({ items: [detail, { ...detail, id: 'q2', text: 'Otra pregunta' }], hasNextPage: false, page: 1, pageSize: 50, total: 2 });
    await open(user);
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), ' editada');
    await user.click(screen.getByRole('button', { name: /Otra pregunta/ }));
    expect(api.adminGetQuestionDetail).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('Pregunta original editada');
    vi.mocked(api.adminGetQuestionDetail).mockResolvedValue({ ...detail, id: 'q2', text: 'Otra pregunta' });
    await user.click(screen.getByRole('button', { name: /Otra pregunta/ }));
    await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('Otra pregunta'));
    expect(screen.getByText('Sin cambios pendientes')).toBeInTheDocument();
  });

  it('valida una creación, impide doble envío y la convierte en edición al confirmar', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.adminCreateQuestion).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('obligatorio');
    await user.type(screen.getByRole('textbox', { name: 'Oposición (UUID)' }), detail.oppositionId!);
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), 'Nueva');
    await user.type(screen.getByRole('textbox', { name: 'Opción A' }), 'Uno');
    await user.type(screen.getByRole('textbox', { name: 'Opción B' }), 'Dos');
    vi.mocked(api.adminCreateQuestion).mockResolvedValue({ ...detail, text: 'Nueva' });
    const save = screen.getByRole('button', { name: 'Guardar' });
    act(() => { fireEvent.click(save); fireEvent.click(save); });
    await waitFor(() => expect(screen.getByText('Sin cambios pendientes')).toBeInTheDocument());
    expect(api.adminCreateQuestion).toHaveBeenCalledOnce();
    expect(api.adminUpdateQuestion).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), ' revisada');
    vi.mocked(api.adminUpdateQuestion).mockResolvedValue(detail);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.adminUpdateQuestion).toHaveBeenCalledWith('q1', expect.anything());
  });

  it('permite salir sin cambios y detecta cambios revertidos', async () => {
    const { user, onClose } = setup();
    const input = screen.getByRole('textbox', { name: 'Pregunta' });
    await user.type(input, 'Borrador');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('confirma nueva ficha, limpiar y salir; cancelar conserva el texto', async () => {
    const { user, onClose } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), 'Borrador');
    for (const name of ['Nueva pregunta', 'Limpiar', 'Volver']) {
      await user.click(screen.getByRole('button', { name }));
      const dialog = screen.getByRole('dialog', { name: '¿Descartar los cambios?' });
      expect(screen.getByRole('button', { name: 'Seguir editando' })).toHaveFocus();
      fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
      expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('Borrador');
      expect(onClose).not.toHaveBeenCalled();
    }
    await user.click(screen.getByRole('button', { name: 'Nueva pregunta' }));
    await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
    expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('');
  });

  it('conserva el borrador e identidad al filtrar y aplicar otra búsqueda', async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), ' revisada');
    await user.type(screen.getByRole('textbox', { name: 'Filtrar oposición' }), 'otra');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    vi.mocked(api.adminUpdateQuestion).mockResolvedValue(detail);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.adminUpdateQuestion).toHaveBeenCalledWith('q1', expect.objectContaining({ text: 'Pregunta original revisada' })));
    expect(api.adminCreateQuestion).not.toHaveBeenCalled();
  });

  it('protege anterior y siguiente y conserva el texto cuando falla la carga', async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), ' editada');
    for (const name of ['Anterior', 'Siguiente']) {
      await user.click(screen.getByRole('button', { name }));
      expect(api.adminFindAdjacentQuestionId).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    }
    vi.mocked(api.adminFindAdjacentQuestionId).mockResolvedValue({ id: 'q2' });
    vi.mocked(api.adminGetQuestionDetail).mockRejectedValueOnce(new Error('Carga fallida'));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Carga fallida');
    expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('Pregunta original editada');
  });

  it('bloquea dobles envíos y salidas durante el guardado; confirma el resultado', async () => {
    const { user, exitGuard } = setup();
    await open(user);
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), ' editada');
    let resolve!: (value: AdminQuestionDetail) => void;
    vi.mocked(api.adminUpdateQuestion).mockReturnValue(new Promise(r => { resolve = r; }));
    const save = screen.getByRole('button', { name: 'Guardar' });
    act(() => { fireEvent.click(save); fireEvent.click(save); });
    expect(api.adminUpdateQuestion).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Pregunta' })).toBeDisabled();
    const leave = vi.fn();
    act(() => exitGuard.current?.(leave));
    expect(leave).not.toHaveBeenCalled();
    await act(async () => resolve({ ...detail, text: 'Pregunta original editada' }));
    expect(screen.getByText('Sin cambios pendientes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver' }));
  });

  it('retiene cambios ante error y permite reintentar una actualización', async () => {
    const { user } = setup();
    await open(user);
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), ' editada');
    vi.mocked(api.adminUpdateQuestion).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(detail);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('Pregunta original editada');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.adminUpdateQuestion).toHaveBeenCalledTimes(2));
  });

  it('registra salida externa y beforeunload solamente con trabajo pendiente', async () => {
    const { user, exitGuard } = setup();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await user.type(screen.getByRole('textbox', { name: 'Pregunta' }), 'Borrador');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    const leave = vi.fn();
    act(() => exitGuard.current?.(leave));
    expect(leave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
    expect(leave).toHaveBeenCalledOnce();
  });
});
