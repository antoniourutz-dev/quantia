import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertCircle, Book, Calendar, Highlighter, X } from 'lucide-react';
import { useAppLocale } from '../lib/locale';

export type FreeHighlightColor = 'yellow' | 'purple' | 'cyan' | 'pink' | 'lime';

export type HighlightType =
  | 'law_reference'
  | 'deadline'
  | 'exception'
  | 'core_concept'
  | 'free';

export interface TextHighlight {
  id: string;
  startIndex: number;
  endIndex: number;
  type: HighlightType;
  color?: FreeHighlightColor;
}

interface HighlightableTextProps {
  text: string;
  highlights: TextHighlight[];
  onAddHighlight: (highlight: Omit<TextHighlight, 'id'>) => void;
  onRemoveHighlight: (id: string) => void;
  readOnly?: boolean;
  maxSelectionChars?: number;
  /** Temporary pre-answer mode: fast color-only toolbar, dashed style, never persisted by itself. */
  ephemeral?: boolean;
}

export const FREE_HIGHLIGHT_COLOR_LIST: Array<{
  id: FreeHighlightColor;
  es: string;
  eu: string;
  swatchClass: string;
  spanClass: string;
  ephemeralSpanClass: string;
}> = [
  {
    id: 'yellow',
    es: 'Amarillo',
    eu: 'Horia',
    swatchClass: 'bg-yellow-400',
    spanClass: 'bg-yellow-300/45 text-yellow-950 border-b-2 border-yellow-500 shadow-[inset_0_-2px_0_0_#eab308]',
    ephemeralSpanClass: 'bg-yellow-300/40 text-yellow-950 border-b-2 border-dashed border-yellow-500',
  },
  {
    id: 'purple',
    es: 'Violeta',
    eu: 'Morea',
    swatchClass: 'bg-purple-400',
    spanClass: 'bg-purple-400/30 text-purple-950 border-b-2 border-purple-500 shadow-[inset_0_-2px_0_0_#a855f7]',
    ephemeralSpanClass: 'bg-purple-300/35 text-purple-950 border-b-2 border-dashed border-purple-500',
  },
  {
    id: 'cyan',
    es: 'Cian',
    eu: 'Ziana',
    swatchClass: 'bg-cyan-400',
    spanClass: 'bg-cyan-400/30 text-cyan-950 border-b-2 border-cyan-500 shadow-[inset_0_-2px_0_0_#06b6d4]',
    ephemeralSpanClass: 'bg-cyan-300/35 text-cyan-950 border-b-2 border-dashed border-cyan-500',
  },
  {
    id: 'pink',
    es: 'Rosa',
    eu: 'Arrosa',
    swatchClass: 'bg-pink-400',
    spanClass: 'bg-pink-400/30 text-pink-950 border-b-2 border-pink-500 shadow-[inset_0_-2px_0_0_#ec4899]',
    ephemeralSpanClass: 'bg-pink-300/35 text-pink-950 border-b-2 border-dashed border-pink-500',
  },
  {
    id: 'lime',
    es: 'Lima',
    eu: 'Lima',
    swatchClass: 'bg-lime-400',
    spanClass: 'bg-lime-400/35 text-lime-950 border-b-2 border-lime-500 shadow-[inset_0_-2px_0_0_#84cc16]',
    ephemeralSpanClass: 'bg-lime-300/35 text-lime-950 border-b-2 border-dashed border-lime-500',
  },
];

const FREE_COLOR_MAP = Object.fromEntries(
  FREE_HIGHLIGHT_COLOR_LIST.map((item) => [item.id, item]),
) as Record<FreeHighlightColor, (typeof FREE_HIGHLIGHT_COLOR_LIST)[number]>;

const FREE_COLOR_STORAGE_KEY = 'quantia.free_highlight_color.v1';

const readPreferredFreeColor = (): FreeHighlightColor => {
  try {
    const stored = window.localStorage.getItem(FREE_COLOR_STORAGE_KEY);
    if (stored && stored in FREE_COLOR_MAP) {
      return stored as FreeHighlightColor;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'yellow';
};

const writePreferredFreeColor = (color: FreeHighlightColor) => {
  try {
    window.localStorage.setItem(FREE_COLOR_STORAGE_KEY, color);
  } catch {
    // Ignore storage access errors
  }
};

const HIGHLIGHT_STYLES: Record<Exclude<HighlightType, 'free'>, string> = {
  law_reference: 'bg-blue-400/30 text-blue-950 border-b-2 border-blue-500 shadow-[inset_0_-2px_0_0_#3b82f6]',
  deadline: 'bg-orange-400/30 text-orange-950 border-b-2 border-orange-500 shadow-[inset_0_-2px_0_0_#f97316]',
  exception: 'bg-rose-400/30 text-rose-950 border-b-2 border-rose-500 shadow-[inset_0_-2px_0_0_#f43f5e]',
  core_concept: 'bg-emerald-400/30 text-emerald-950 border-b-2 border-emerald-500 shadow-[inset_0_-2px_0_0_#10b981]',
};

const getHighlightSpanClass = (highlight: TextHighlight, ephemeral: boolean): string => {
  if (highlight.type === 'free') {
    const colorMeta = FREE_COLOR_MAP[highlight.color ?? 'yellow'] ?? FREE_COLOR_MAP.yellow;
    return ephemeral ? colorMeta.ephemeralSpanClass : colorMeta.spanClass;
  }
  return HIGHLIGHT_STYLES[highlight.type];
};

export default function HighlightableText({
  text,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  readOnly = false,
  maxSelectionChars,
  ephemeral = false,
}: HighlightableTextProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRange, setSelectionRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; top: number; left: number } | null>(null);
  const [freePaletteOpen, setFreePaletteOpen] = useState(false);
  const [selectedFreeColor, setSelectedFreeColor] = useState<FreeHighlightColor>(readPreferredFreeColor);
  const dismissedRangeRef = useRef<string | null>(null);

  const dismissSelection = () => {
    if (selectionRange) {
      dismissedRangeRef.current = `${selectionRange.startIndex}:${selectionRange.endIndex}`;
    }
    window.getSelection()?.removeAllRanges();
    setSelectionRange(null);
    setPopupPos(null);
    setFreePaletteOpen(false);
  };

  const getAbsoluteOffset = useCallback((container: Node, targetNode: Node, localOffset: number) => {
    const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let offset = 0;
    while (treeWalker.nextNode()) {
      if (treeWalker.currentNode === targetNode) {
        return offset + localOffset;
      }
      offset += treeWalker.currentNode.nodeValue?.length || 0;
    }
    return offset;
  }, []);

  const handleSelection = useCallback(() => {
    if (readOnly) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      dismissedRangeRef.current = null;
      setSelectionRange(null);
      setPopupPos(null);
      setFreePaletteOpen(false);
      return;
    }

    if (
      !containerRef.current.contains(sel.anchorNode) ||
      !containerRef.current.contains(sel.focusNode)
    ) {
      setSelectionRange(null);
      setPopupPos(null);
      setFreePaletteOpen(false);
      return;
    }

    let start = getAbsoluteOffset(containerRef.current, sel.anchorNode!, sel.anchorOffset);
    let end = getAbsoluteOffset(containerRef.current, sel.focusNode!, sel.focusOffset);

    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    if (end > start) {
      // Ignore a selection the user has just applied or dismissed until it changes
      // (some browsers keep the range alive briefly after removeAllRanges()).
      if (dismissedRangeRef.current === `${start}:${end}`) {
        return;
      }
      dismissedRangeRef.current = null;
      if (typeof maxSelectionChars === 'number' && maxSelectionChars > 0) {
        const selectionLength = end - start;
        if (selectionLength > maxSelectionChars) {
          setSelectionRange(null);
          setPopupPos(null);
          setFreePaletteOpen(false);
          return;
        }
      }
      setSelectionRange((prev) => {
        if (!prev || prev.startIndex !== start || prev.endIndex !== end) {
          setFreePaletteOpen(false);
        }
        return { startIndex: start, endIndex: end };
      });
      setPendingDelete(null);
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPopupPos({
        top: Math.max(10, rect.top - 70),
        left: Math.max(10, rect.left + rect.width / 2),
      });
    }
  }, [getAbsoluteOffset, maxSelectionChars, readOnly]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [handleSelection]);

  const chunks = useMemo(() => {
    const sorted = [...highlights].sort((a, b) => a.startIndex - b.startIndex);
    const result: Array<{ text: string; highlight?: TextHighlight }> = [];
    let currentIndex = 0;

    for (const hl of sorted) {
      if (hl.startIndex > currentIndex) {
        result.push({ text: text.slice(currentIndex, hl.startIndex) });
      }
      const end = Math.min(hl.endIndex, text.length);
      if (end > Math.max(currentIndex, hl.startIndex)) {
        result.push({
          text: text.slice(Math.max(currentIndex, hl.startIndex), end),
          highlight: hl,
        });
        currentIndex = end;
      }
    }

    if (currentIndex < text.length) {
      result.push({ text: text.slice(currentIndex) });
    }

    return result;
  }, [text, highlights]);

  const applyFreeHighlight = (color: FreeHighlightColor) => {
    if (!selectionRange) return;
    setSelectedFreeColor(color);
    if (!ephemeral) {
      writePreferredFreeColor(color);
    }
    onAddHighlight({ ...selectionRange, type: 'free', color });
    dismissSelection();
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="highlightable-text whitespace-pre-wrap leading-relaxed select-text">
        {chunks.map((chunk, i) => (
          <span
            key={i}
            className={`transition-all duration-300 ${chunk.highlight ? getHighlightSpanClass(chunk.highlight, ephemeral) : ''} ${chunk.highlight && !readOnly ? 'cursor-pointer hover:brightness-95' : ''}`}
            onClick={(e) => {
              if (!readOnly && chunk.highlight) {
                e.stopPropagation();
                if (ephemeral) {
                  // Ephemeral draft marks remove in 1 click without modal friction
                  onRemoveHighlight(chunk.highlight.id);
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                setPendingDelete({
                  id: chunk.highlight.id,
                  top: Math.max(10, rect.top - 52),
                  left: Math.max(10, rect.left + rect.width / 2),
                });
                setSelectionRange(null);
                setPopupPos(null);
              }
            }}
          >
            {chunk.text}
          </span>
        ))}
      </div>

      {pendingDelete && !readOnly && createPortal(
        <div
          className="fixed z-[10000] -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-[0_15px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-150"
          style={{ top: pendingDelete.top, left: pendingDelete.left }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{isBasque ? 'Nabarmendua kendu?' : '¿Eliminar resaltado?'}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveHighlight(pendingDelete.id);
              setPendingDelete(null);
              setSelectionRange(null);
              setPopupPos(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white transition-all hover:bg-rose-600"
          >
            {isBasque ? 'Kendu' : 'Eliminar'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPendingDelete(null);
            }}
            aria-label={isBasque ? 'Utzi' : 'Cancelar'}
            className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold text-slate-300 transition-all hover:bg-white/20"
          >
            {isBasque ? 'Utzi' : 'Cancelar'}
          </button>
        </div>,
        document.body,
      )}

      {popupPos && selectionRange && !readOnly && createPortal(
        ephemeral ? (
          <div
            className="fixed z-[10000] -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-slate-900 shadow-[0_15px_50px_rgba(0,0,0,0.5)] border border-white/15 rounded-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150"
            style={{ top: popupPos.top, left: popupPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 pr-1">
              {isBasque ? 'Zirriborroa' : 'Borrador'}
            </span>
            <div className="flex items-center gap-1.5">
              {FREE_HIGHLIGHT_COLOR_LIST.map((colorOption) => (
                <button
                  key={colorOption.id}
                  type="button"
                  aria-label={`${isBasque ? 'Zirriborroa' : 'Borrador'} · ${isBasque ? colorOption.eu : colorOption.es}`}
                  onClick={(e) => {
                    e.preventDefault();
                    applyFreeHighlight(colorOption.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 transition-transform hover:scale-110 active:scale-95"
                >
                  <span className={`h-4 w-4 rounded-full ${colorOption.swatchClass}`} />
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-white/15 mx-0.5" />
            <button
              type="button"
              aria-label={isBasque ? 'Itxi' : 'Cerrar'}
              onClick={(e) => {
                e.preventDefault();
                dismissSelection();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            className="fixed z-[10000] -translate-x-1/2 flex flex-col items-center gap-1.5 p-2 bg-slate-900 shadow-[0_15px_50px_rgba(0,0,0,0.5)] border border-white/10 rounded-[1.25rem] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            style={{ top: popupPos.top, left: popupPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={isBasque ? 'Funtsezko kontzeptua' : 'Concepto clave'}
                onClick={(e) => {
                  e.preventDefault();
                  onAddHighlight({ ...selectionRange, type: 'core_concept' });
                  dismissSelection();
                }}
                className="w-11 h-11 flex flex-col items-center justify-center rounded-xl hover:bg-emerald-500/20 text-emerald-400 transition-all active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Check size={18} />
                <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{isBasque ? 'Gakoa' : 'Clave'}</span>
              </button>
              <button
                type="button"
                aria-label={isBasque ? 'Lege-erreferentzia' : 'Referencia legal'}
                onClick={(e) => {
                  e.preventDefault();
                  onAddHighlight({ ...selectionRange, type: 'law_reference' });
                  dismissSelection();
                }}
                className="w-11 h-11 flex flex-col items-center justify-center rounded-xl hover:bg-blue-500/20 text-blue-400 transition-all active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Book size={18} />
                <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{isBasque ? 'Legea' : 'Ley'}</span>
              </button>
              <button
                type="button"
                aria-label={isBasque ? 'Epea edo data' : 'Plazo o fecha'}
                onClick={(e) => {
                  e.preventDefault();
                  onAddHighlight({ ...selectionRange, type: 'deadline' });
                  dismissSelection();
                }}
                className="w-11 h-11 flex flex-col items-center justify-center rounded-xl hover:bg-orange-500/20 text-orange-400 transition-all active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Calendar size={18} />
                <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{isBasque ? 'Epea' : 'Plazo'}</span>
              </button>
              <button
                type="button"
                aria-label={isBasque ? 'Salbuespena' : 'Excepción'}
                onClick={(e) => {
                  e.preventDefault();
                  onAddHighlight({ ...selectionRange, type: 'exception' });
                  dismissSelection();
                }}
                className="w-11 h-11 flex flex-col items-center justify-center rounded-xl hover:bg-rose-500/20 text-rose-400 transition-all active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <AlertCircle size={18} />
                <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{isBasque ? 'Salb.' : 'Excep.'}</span>
              </button>
              <button
                type="button"
                aria-label={isBasque ? 'Markatzaile librea' : 'Marcador libre'}
                aria-expanded={freePaletteOpen}
                onClick={(e) => {
                  e.preventDefault();
                  setFreePaletteOpen((prev) => !prev);
                }}
                className={`w-11 h-11 flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 ${
                  freePaletteOpen
                    ? 'bg-white/15 text-yellow-300'
                    : 'hover:bg-yellow-400/20 text-yellow-300'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="relative">
                  <Highlighter size={17} />
                  <span
                    className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ring-1 ring-slate-900 ${FREE_COLOR_MAP[selectedFreeColor].swatchClass}`}
                  />
                </div>
                <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{isBasque ? 'Librea' : 'Libre'}</span>
              </button>

              <div className="w-px h-8 bg-white/10 mx-1" />

              <button
                type="button"
                aria-label={isBasque ? 'Itxi' : 'Cerrar'}
                onClick={(e) => {
                  e.preventDefault();
                  dismissSelection();
                }}
                className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-400 transition-all active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <X size={20} />
              </button>
            </div>

            {freePaletteOpen ? (
              <div
                role="group"
                aria-label={isBasque ? 'Aukeratu kolorea' : 'Elegir color'}
                className="flex items-center gap-2 border-t border-white/10 pt-2 pb-0.5 px-1"
              >
                {FREE_HIGHLIGHT_COLOR_LIST.map((colorOption) => (
                  <button
                    key={colorOption.id}
                    type="button"
                    aria-label={isBasque ? colorOption.eu : colorOption.es}
                    onClick={(e) => {
                      e.preventDefault();
                      applyFreeHighlight(colorOption.id);
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-110 active:scale-95 ${
                      selectedFreeColor === colorOption.id
                        ? 'border-white ring-2 ring-white/40'
                        : 'border-white/25'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full ${colorOption.swatchClass}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ),
        document.body,
      )}
    </div>
  );
}
