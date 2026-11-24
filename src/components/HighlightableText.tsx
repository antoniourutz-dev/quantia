import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertCircle, Book, Calendar, X } from 'lucide-react';
import { useAppLocale } from '../lib/locale';

export type HighlightType = 'law_reference' | 'deadline' | 'exception' | 'core_concept';

export interface TextHighlight {
  id: string;
  startIndex: number;
  endIndex: number;
  type: HighlightType;
}

interface HighlightableTextProps {
  text: string;
  highlights: TextHighlight[];
  onAddHighlight: (highlight: Omit<TextHighlight, 'id'>) => void;
  onRemoveHighlight: (id: string) => void;
  readOnly?: boolean;
  maxSelectionChars?: number;
}

const HIGHLIGHT_STYLES: Record<HighlightType, string> = {
  law_reference: 'bg-blue-400/30 text-blue-950 border-b-2 border-blue-500 shadow-[inset_0_-2px_0_0_#3b82f6]',
  deadline: 'bg-orange-400/30 text-orange-950 border-b-2 border-orange-500 shadow-[inset_0_-2px_0_0_#f97316]',
  exception: 'bg-rose-400/30 text-rose-950 border-b-2 border-rose-500 shadow-[inset_0_-2px_0_0_#f43f5e]',
  core_concept: 'bg-emerald-400/30 text-emerald-950 border-b-2 border-emerald-500 shadow-[inset_0_-2px_0_0_#10b981]',
};

export default function HighlightableText({
  text,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  readOnly = false,
  maxSelectionChars,
}: HighlightableTextProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRange, setSelectionRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; top: number; left: number } | null>(null);
  const dismissedRangeRef = useRef<string | null>(null);

  const dismissSelection = () => {
    if (selectionRange) {
      dismissedRangeRef.current = `${selectionRange.startIndex}:${selectionRange.endIndex}`;
    }
    window.getSelection()?.removeAllRanges();
    setSelectionRange(null);
    setPopupPos(null);
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
      return;
    }

    if (
      !containerRef.current.contains(sel.anchorNode) ||
      !containerRef.current.contains(sel.focusNode)
    ) {
      setSelectionRange(null);
      setPopupPos(null);
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
          return;
        }
      }
      setSelectionRange({ startIndex: start, endIndex: end });
      setPendingDelete(null);
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPopupPos({
        top: Math.max(10, rect.top - 70), // Slightly higher
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

  return (
    <div className="relative">
      <div ref={containerRef} className="highlightable-text whitespace-pre-wrap leading-relaxed select-text">
        {chunks.map((chunk, i) => (
          <span
            key={i}
            className={`transition-all duration-300 ${chunk.highlight ? HIGHLIGHT_STYLES[chunk.highlight.type] : ''} ${chunk.highlight ? 'cursor-pointer hover:brightness-95' : ''}`}
            onClick={(e) => {
              if (!readOnly && chunk.highlight) {
                e.stopPropagation();
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
        <div
          className="fixed z-[10000] -translate-x-1/2 flex items-center gap-1.5 p-2 bg-slate-900 shadow-[0_15px_50px_rgba(0,0,0,0.5)] border border-white/10 rounded-[1.25rem] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
          style={{ top: popupPos.top, left: popupPos.left }}
          onMouseDown={(e) => e.stopPropagation()} // Prevent closing on click
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}
