import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Edit2, Eraser, AlertCircle, Book, Calendar } from 'lucide-react';
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
}

const HIGHLIGHT_STYLES: Record<HighlightType, string> = {
  law_reference: 'bg-blue-100/80 text-blue-900 border-b-2 border-blue-300',
  deadline: 'bg-orange-100/80 text-orange-900 border-b-2 border-orange-300',
  exception: 'bg-rose-100/80 text-rose-900 border-b-2 border-rose-300',
  core_concept: 'bg-emerald-100/80 text-emerald-900 border-b-2 border-emerald-300',
};

const HIGHLIGHT_ICONS: Record<HighlightType, React.ElementType> = {
  law_reference: Book,
  deadline: Calendar,
  exception: AlertCircle,
  core_concept: Check,
};

export default function HighlightableText({
  text,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  readOnly = false,
}: HighlightableTextProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

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

    // Only allow if no overlap with existing?
    // For simplicity, allow overlapping logic or trim it. But let's just let it be.
    if (end > start) {
      setSelectionRange({ start, end });
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPopupPos({
        top: Math.max(10, rect.top - 60),
        left: Math.max(10, rect.left + rect.width / 2),
      });
    }
  }, [getAbsoluteOffset, readOnly]);

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
      <div ref={containerRef} className="highlightable-text whitespace-pre-wrap leading-relaxed">
        {chunks.map((chunk, i) => (
          <span
            key={i}
            className={chunk.highlight ? HIGHLIGHT_STYLES[chunk.highlight.type] : ''}
            onClick={(e) => {
              if (!readOnly && chunk.highlight) {
                e.stopPropagation();
                if (window.confirm(isBasque ? 'Nabarmendua kendu nahi duzu?' : '¿Eliminar este resaltado?')) {
                  onRemoveHighlight(chunk.highlight.id);
                  setSelectionRange(null);
                  setPopupPos(null);
                  window.getSelection()?.removeAllRanges();
                }
              }
            }}
          >
            {chunk.text}
          </span>
        ))}
      </div>

      {popupPos && selectionRange && !readOnly && createPortal(
        <div
          className="fixed z-[9999] -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-slate-900 shadow-[0_10px_40px_rgba(0,0,0,0.3)] rounded-2xl animate-in fade-in zoom-in-95 duration-200"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          <button
            onClick={() => {
              onAddHighlight({ ...selectionRange, type: 'core_concept' });
              window.getSelection()?.removeAllRanges();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-emerald-400 transition-colors"
            title={isBasque ? 'Kontzeptu nagusia' : 'Concepto central'}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Check size={20} />
          </button>
          <button
            onClick={() => {
              onAddHighlight({ ...selectionRange, type: 'law_reference' });
              window.getSelection()?.removeAllRanges();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-blue-400 transition-colors"
            title={isBasque ? 'Lege-erreferentzia' : 'Referencia legal'}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Book size={20} />
          </button>
          <button
            onClick={() => {
              onAddHighlight({ ...selectionRange, type: 'deadline' });
              window.getSelection()?.removeAllRanges();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-orange-400 transition-colors"
            title={isBasque ? 'Epea' : 'Plazo'}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Calendar size={20} />
          </button>
          <button
            onClick={() => {
              onAddHighlight({ ...selectionRange, type: 'exception' });
              window.getSelection()?.removeAllRanges();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-rose-400 transition-colors"
            title={isBasque ? 'Salbuespena' : 'Excepción'}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <AlertCircle size={20} />
          </button>
          
          <div className="w-px h-6 bg-white/10 mx-1" />
          
          <button
            onClick={() => {
              window.getSelection()?.removeAllRanges();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-400 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Eraser size={20} />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
