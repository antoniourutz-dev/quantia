import { useEffect, useRef, useState } from 'react';

export type EditorExitGuard = { current: ((action: () => void) => void) | null };

export function useEditorSafety(dirty: boolean, busy: boolean, exitGuard?: EditorExitGuard, isBasque = false) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const state = useRef({ dirty, busy });
  state.current = { dirty, busy };
  const request = (action: () => void) => {
    if (state.current.busy) return;
    if (state.current.dirty) setPending(() => action);
    else action();
  };

  useEffect(() => {
    if (!exitGuard) return;
    exitGuard.current = request;
    return () => { exitGuard.current = null; };
  }, [exitGuard]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);

  const t = (es: string, eu: string) => isBasque ? eu : es;
  const confirmation = (
    <dialog ref={dialog} aria-labelledby="editor-exit-title" aria-describedby="editor-exit-description"
      onCancel={() => setPending(null)}
      className="w-[calc(100%-2rem)] max-w-md rounded-3xl p-6 shadow-2xl backdrop:bg-slate-900/50">
      <h2 id="editor-exit-title" className="text-xl font-bold">{t('¿Descartar los cambios?', 'Aldaketak baztertu?')}</h2>
      <p id="editor-exit-description" className="my-4 text-slate-600">{t('Hay cambios sin guardar. Puedes seguir editando o descartarlos para continuar. No hay autoguardado.', 'Gorde gabeko aldaketak daude. Editatzen jarraitu edo baztertu ditzakezu. Ez dago gordetze automatikorik.')}</p>
      <div className="flex flex-wrap gap-3">
        <button autoFocus type="button" onClick={() => setPending(null)} className="min-h-11 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">{t('Seguir editando', 'Jarraitu editatzen')}</button>
        <button type="button" onClick={() => {
          const action = pending;
          setPending(null);
          if (!state.current.busy) action?.();
        }} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 font-bold">{t('Descartar y continuar', 'Baztertu eta jarraitu')}</button>
      </div>
    </dialog>
  );
  return { request, confirmation };
}
