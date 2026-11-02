import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

type ConfirmExitDialogProps = {
  isBasque: boolean;
  answeredCount: number;
  onStay: () => void;
  onDiscard: () => void;
};

/** A focused, keyboard-accessible confirmation for unsaved learning sessions. */
export default function ConfirmExitDialog({
  isBasque,
  answeredCount,
  onStay,
  onDiscard,
}: ConfirmExitDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    stayRef.current?.focus();

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onStay();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [onStay]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <AlertTriangle aria-hidden="true" size={24} />
        </div>
        <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-slate-900">
          {isBasque ? 'Saioa utzi nahi duzu?' : '¿Quieres abandonar el test?'}
        </h2>
        <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-slate-600">
          {answeredCount > 0
            ? isBasque
              ? `${answeredCount} erantzun dituzu. Orain irteten bazara, saioko emaitza ez da gordeko.`
              : `Has respondido ${answeredCount} preguntas. Si sales ahora, no se guardará el resultado de esta sesión.`
            : isBasque
              ? 'Saioa oraindik ez da amaitu. Irteten bazara, ez da emaitzarik gordeko.'
              : 'La sesión aún no ha terminado. Si sales, no se guardará ningún resultado.'}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-12 rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
          >
            {isBasque ? 'Saioa utzi' : 'Salir sin guardar'}
          </button>
          <button
            ref={stayRef}
            type="button"
            onClick={onStay}
            className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
          >
            {isBasque ? 'Jarraitu ikasten' : 'Seguir con el test'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
