import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import MarkdownBody from './MarkdownBody';

export interface RepasoCard {
  id: string;
  front: string;
  back: string;
}

/** «1. **Jerarquía:** Constitución → ley…» de la sección «Las N reglas» del repaso exprés. */
export const parseRepasoCards = (md: string): RepasoCard[] => {
  const lines = md.split('\n');
  const start = lines.findIndex((line) => /^##\s+Las\s+\d+\s+reglas/i.test(line));
  if (start < 0) return [];
  const cards: RepasoCard[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    const match = line.match(/^(\d+)\.\s+\*\*(.+?):?\*\*:?\s*(.+)$/);
    if (match) cards.push({ id: match[1], front: match[2].replace(/:$/, ''), back: match[3] });
  }
  return cards;
};

interface Props {
  title: string;
  cards: RepasoCard[];
  onClose: () => void;
}

/** Repaso activo: el alumno ve el nombre de la regla, intenta recordarla y luego la comprueba. */
export default function RepasoCards({ title, cards, onClose }: Props) {
  const [deck, setDeck] = useState<RepasoCard[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [missed, setMissed] = useState<RepasoCard[]>([]);
  const [known, setKnown] = useState(0);
  const card = deck[index] ?? null;
  const finished = index >= deck.length;

  const answer = (knewIt: boolean) => {
    if (!card) return;
    if (knewIt) setKnown((n) => n + 1);
    else setMissed((list) => [...list, card]);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  const restart = (list: RepasoCard[]) => {
    setDeck(list);
    setIndex(0);
    setKnown(0);
    setMissed([]);
    setFlipped(false);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      } else if (!finished && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setFlipped((f) => !f);
      } else if (!finished && flipped && event.key === '1') answer(true);
      else if (!finished && flipped && event.key === '2') answer(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const progress = useMemo(() => Math.round((Math.min(index, deck.length) / Math.max(1, deck.length)) * 100), [index, deck.length]);

  return (
    <div
      className="study-reader-chrome fixed inset-0 z-[75] flex flex-col bg-[color:var(--sr-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Repaso en tarjetas"
    >
      <div className="flex items-center gap-3 border-b border-[color:var(--sr-border)] px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-[color:var(--sr-accent)]">Repaso en tarjetas</p>
          <p className="truncate text-sm font-bold">{title}</p>
        </div>
        <span className="text-sm font-bold text-[color:var(--sr-muted)]">
          {Math.min(index + 1, deck.length)} / {deck.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[color:var(--sr-surface)]"
          aria-label="Cerrar tarjetas"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="h-1 bg-[color:var(--sr-surface)]" aria-hidden="true">
        <div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-8">
        {finished ? (
          <div className="w-full max-w-xl text-center">
            <p className="text-2xl font-black">
              {known} de {deck.length} las sabías
            </p>
            <p className="mt-2 text-[color:var(--sr-muted)]">
              {missed.length ? 'Repite las que fallaste hasta que salgan todas.' : 'Todas bien. Vuelve a ellas dentro de unos días.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {missed.length ? (
                <button
                  type="button"
                  onClick={() => restart(missed)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white"
                >
                  <RotateCcw size={16} aria-hidden="true" /> Repetir las {missed.length} que fallé
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => restart(cards)}
                className="rounded-2xl border border-[color:var(--sr-border)] px-4 py-3 text-sm font-bold"
              >
                Empezar de nuevo
              </button>
              <button type="button" onClick={onClose} className="rounded-2xl px-4 py-3 text-sm font-bold text-[color:var(--sr-muted)]">
                Volver al repaso
              </button>
            </div>
          </div>
        ) : card ? (
          <div className="w-full max-w-2xl">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="block min-h-[16rem] w-full rounded-3xl border border-[color:var(--sr-border)] bg-[color:var(--sr-surface)] p-6 text-left shadow-sm sm:p-8"
              aria-label={flipped ? 'Ocultar la regla' : 'Mostrar la regla'}
            >
              <span className="block text-xs font-black uppercase tracking-wider text-[color:var(--sr-muted)]">
                Regla {card.id}
              </span>
              <span className="mt-2 block font-[Inter,system-ui,sans-serif] text-2xl font-black leading-tight sm:text-3xl">
                {card.front}
              </span>
              {flipped ? (
                <span className="study-prose mt-5 block border-t border-[color:var(--sr-border)] pt-4">
                  <MarkdownBody body={card.back} />
                </span>
              ) : (
                <span className="mt-6 block text-sm font-semibold text-[color:var(--sr-accent)]">
                  Intenta recordarla y toca para comprobar
                </span>
              )}
            </button>
            {flipped ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => answer(false)}
                  className="rounded-2xl border border-[color:var(--sr-border)] px-4 py-3.5 text-sm font-black"
                >
                  Repasar
                </button>
                <button
                  type="button"
                  onClick={() => answer(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white"
                >
                  <Check size={16} aria-hidden="true" /> Lo sabía
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
