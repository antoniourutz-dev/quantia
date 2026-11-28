import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  List,
  MessageSquarePlus,
  NotebookPen,
  StickyNote,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import MarkdownBody from './MarkdownBody';
import { applyMarks, BLOCK_ATTR, clearMarks, findQuote, MARK_ATTR, rangeToSpans, spansText } from './annotationDom';
import { readToc, resolveStudyLink, type TocEntry } from './markdown';
import { buildStudentViewContext, toStudentView } from './studentView';
import {
  createStudyAnnotation,
  deleteStudyAnnotation,
  getStudyVersionBody,
  listStudyAnnotations,
  listStudyProgress,
  saveStudyProgress,
  updateStudyAnnotation,
} from './studyTopicsApi';
import {
  DOCUMENT_KIND_LABEL,
  type AnnotationColor,
  type AnnotationSpan,
  type StudyAnnotation,
  type StudyDocumentKind,
  type StudyProgress,
  type StudyTopicSummary,
} from './types';
import { useReaderPrefs, FONT_SIZES } from './readerPrefs';
import './studyReader.css';

const COLORS: Array<{ id: AnnotationColor; label: string; swatch: string }> = [
  { id: 'yellow', label: 'Amarillo', swatch: 'bg-yellow-300' },
  { id: 'green', label: 'Verde', swatch: 'bg-green-300' },
  { id: 'blue', label: 'Azul', swatch: 'bg-blue-300' },
  { id: 'pink', label: 'Rosa', swatch: 'bg-pink-300' },
  { id: 'orange', label: 'Naranja', swatch: 'bg-orange-300' },
];

const COLOR_DOT: Record<AnnotationColor, string> = {
  yellow: 'bg-yellow-300',
  green: 'bg-green-300',
  blue: 'bg-blue-300',
  pink: 'bg-pink-300',
  orange: 'bg-orange-300',
};

export interface ReaderLocation {
  code: string;
  kind: StudyDocumentKind;
  anchor: string | null;
}

interface Props {
  topic: StudyTopicSummary;
  topics: StudyTopicSummary[];
  kind: StudyDocumentKind;
  anchor: string | null;
  userId: string;
  onNavigate: (location: ReaderLocation) => void;
  onClose: () => void;
}

type SelectionState = {
  spans: AnnotationSpan[];
  quote: string;
  rect: DOMRect;
} | null;
type OpenAnnotation = {
  id: string;
  rect: DOMRect | null;
  editingNote: boolean;
} | null;

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}-${m}-${y}` : iso;
};

export default function StudyTopicReader({ topic, topics, kind, anchor, userId, onNavigate, onClose }: Props) {
  const document = topic.documents.find((doc) => doc.kind === kind) ?? topic.documents[0];
  const version = document.current!;
  const [prefs, setPrefs] = useReaderPrefs();
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<StudyAnnotation[]>([]);
  const [progress, setProgress] = useState<Record<string, StudyProgress>>({});
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [panel, setPanel] = useState<'toc' | 'notes' | 'settings' | null>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [openAnnotation, setOpenAnnotation] = useState<OpenAnnotation>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [generalNoteOpen, setGeneralNoteOpen] = useState(false);
  const [readRatio, setReadRatio] = useState(0);
  const [resumeBlock, setResumeBlock] = useState<string | null>(null);
  const [orphanIds, setOrphanIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const maxRatioRef = useRef(0);
  const lastBlockRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);

  const topicIndex = topics.findIndex((t) => t.id === topic.id);
  const documentIndex = topic.documents.findIndex((d) => d.id === document.id);
  const nextDocument = topic.documents[documentIndex + 1] ?? null;
  const nextTopic = topics[topicIndex + 1] ?? null;
  const previousTopic = topics[topicIndex - 1] ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  // The reader is a full-screen layer: keep the page behind it from scrolling.
  useEffect(() => {
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => {
      window.document.body.style.overflow = previous;
    };
  }, []);

  // Load body, annotations of the whole topic and progress.
  useEffect(() => {
    let cancelled = false;
    setBody(null);
    setLoadError(null);
    setSelection(null);
    setOpenAnnotation(null);
    maxRatioRef.current = 0;
    lastBlockRef.current = null;
    dirtyRef.current = false;
    // Los códigos internos (R001, E01, PLAZO) se traducen para el alumno con el manual y los errores del tema.
    const bodyOf = (k: StudyDocumentKind) => {
      const v = topic.documents.find((d) => d.kind === k)?.current;
      return v ? getStudyVersionBody(v.id).catch(() => null) : Promise.resolve(null);
    };
    Promise.all([getStudyVersionBody(version.id), bodyOf('manual'), bodyOf('errores')])
      .then(([value, manualMd, erroresMd]) => {
        if (cancelled) return;
        const context = buildStudentViewContext(topic.code, manualMd, erroresMd);
        setBody(toStudentView(value, context, document.kind));
      })
      .catch((error: Error) => !cancelled && setLoadError(error.message));
    const ids = topic.documents.map((d) => d.id);
    listStudyAnnotations(ids)
      .then((rows) => !cancelled && setAnnotations(rows))
      .catch(() => undefined);
    listStudyProgress(ids)
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, StudyProgress> = {};
        rows.forEach((row) => (map[row.documentId] = row));
        setProgress(map);
        const mine = map[document.id];
        if (mine && mine.versionId === version.id) {
          maxRatioRef.current = mine.progress;
          if (!anchor && mine.lastBlock && mine.progress > 0.03 && !mine.completedAt) setResumeBlock(mine.lastBlock);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [version.id, topic.id]);

  // Save reading progress (debounced and on leave).
  const flushProgress = useCallback(
    (completed?: boolean) => {
      if (!dirtyRef.current && completed === undefined) return Promise.resolve();
      dirtyRef.current = false;
      return saveStudyProgress(userId, {
        documentId: document.id,
        versionId: version.id,
        progress: completed ? 1 : maxRatioRef.current,
        lastBlock: lastBlockRef.current,
        completed,
      }).catch(() => undefined);
    },
    [document.id, version.id, userId],
  );
  useEffect(() => {
    const timer = window.setInterval(() => void flushProgress(), 4000);
    return () => {
      window.clearInterval(timer);
      void flushProgress();
    };
  }, [flushProgress]);

  // After the body renders: table of contents, deep link, heading observer.
  useLayoutEffect(() => {
    const root = articleRef.current;
    if (!root || body === null) return;
    setToc(readToc(root));
    const container = scrollRef.current;
    if (anchor) {
      const target = root.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        target.classList.add('sr-heading-flash');
        window.setTimeout(() => target.classList.remove('sr-heading-flash'), 1400);
      }
    } else if (container) {
      container.scrollTop = 0;
    }
  }, [body, anchor]);

  useEffect(() => {
    const root = articleRef.current;
    const container = scrollRef.current;
    if (!root || !container || body === null) return;
    const headings = Array.from(root.querySelectorAll<HTMLElement>('h2[id], h3[id]'));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveHeading(visible[0].target.id);
      },
      { root: container, rootMargin: '-80px 0px -70% 0px' },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [body]);

  // Scroll: progress bar, furthest point read, first visible block.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || body === null) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = container.scrollHeight - container.clientHeight;
        const ratio = max > 0 ? Math.min(1, container.scrollTop / max) : 1;
        setReadRatio(ratio);
        if (ratio > maxRatioRef.current + 0.005) {
          maxRatioRef.current = ratio;
          dirtyRef.current = true;
        }
        const top = container.getBoundingClientRect().top + 90;
        const blocks = articleRef.current?.querySelectorAll<HTMLElement>(`[${BLOCK_ATTR}]`) ?? [];
        for (const block of Array.from(blocks)) {
          if (block.getBoundingClientRect().bottom > top) {
            const id = block.getAttribute(BLOCK_ATTR);
            if (id && id !== lastBlockRef.current) {
              lastBlockRef.current = id;
              dirtyRef.current = true;
            }
            break;
          }
        }
        setSelection(null);
        setOpenAnnotation((current) => (current && !current.editingNote ? null : current));
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener('scroll', onScroll);
    };
  }, [body]);

  const documentAnnotations = useMemo(
    () => annotations.filter((a) => a.documentId === document.id),
    [annotations, document.id],
  );

  // Paint highlights. Older-version annotations are re-anchored by their quote.
  useLayoutEffect(() => {
    const root = articleRef.current;
    if (!root || body === null) return;
    clearMarks(root);
    const orphans = new Set<string>();
    const requests = documentAnnotations
      .filter((a) => a.kind !== 'bookmark')
      .map((a) => {
        let spans = a.spans;
        if (a.versionId !== version.id) spans = a.quote ? findQuote(root, a.quote, a.anchorBlock) : [];
        if (a.kind === 'highlight' && spans.length === 0) orphans.add(a.id);
        return {
          id: a.id,
          spans: a.kind === 'highlight' ? spans : [],
          className: `sr-hl-${a.color ?? 'yellow'}${a.note ? ' sr-has-note' : ''}`,
          title: a.note ?? undefined,
        };
      });
    applyMarks(root, requests);
    setOrphanIds(orphans);
  }, [documentAnnotations, body, version.id]);

  // Text selection → floating toolbar.
  useEffect(() => {
    const onSelectionChange = () => {
      const root = articleRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const spans = rangeToSpans(root, range);
      const quote = spansText(root, spans).slice(0, 8000);
      if (spans.length === 0 || !quote.trim()) {
        setSelection(null);
        return;
      }
      setOpenAnnotation(null);
      setSelection({ spans, quote, rect: range.getBoundingClientRect() });
    };
    let timer = 0;
    const debounced = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onSelectionChange, 120);
    };
    window.document.addEventListener('selectionchange', debounced);
    return () => {
      window.clearTimeout(timer);
      window.document.removeEventListener('selectionchange', debounced);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openAnnotation) setOpenAnnotation(null);
      else if (panel) setPanel(null);
      else if (selection) {
        window.getSelection()?.removeAllRanges();
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAnnotation, panel, selection]);

  const addHighlight = async (color: AnnotationColor, withNote: boolean) => {
    if (!selection || busy) return;
    setBusy(true);
    try {
      const created = await createStudyAnnotation({
        documentId: document.id,
        versionId: version.id,
        kind: 'highlight',
        color,
        spans: selection.spans,
        anchorBlock: selection.spans[0]?.b ?? null,
        quote: selection.quote,
        note: null,
      });
      setAnnotations((current) => [...current, created]);
      window.getSelection()?.removeAllRanges();
      const rect = selection.rect;
      setSelection(null);
      if (withNote) {
        setNoteDraft('');
        setOpenAnnotation({ id: created.id, rect, editingNote: true });
      }
    } catch {
      showToast('No se ha podido guardar el subrayado. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const patchAnnotation = async (id: string, patch: Partial<Pick<StudyAnnotation, 'color' | 'note'>>) => {
    try {
      const updated = await updateStudyAnnotation(id, patch);
      setAnnotations((current) => current.map((a) => (a.id === id ? updated : a)));
      return true;
    } catch {
      showToast('No se ha podido guardar el cambio.');
      return false;
    }
  };

  const removeAnnotation = async (id: string) => {
    try {
      await deleteStudyAnnotation(id);
      setAnnotations((current) => current.filter((a) => a.id !== id));
      setOpenAnnotation(null);
    } catch {
      showToast('No se ha podido borrar.');
    }
  };

  const addGeneralNote = async () => {
    const text = noteDraft.trim();
    if (!text) return;
    const root = articleRef.current;
    const heading =
      activeHeading && root ? root.querySelector<HTMLElement>(`[id="${CSS.escape(activeHeading)}"]`) : null;
    try {
      const created = await createStudyAnnotation({
        documentId: document.id,
        versionId: version.id,
        kind: 'note',
        color: null,
        spans: [],
        anchorBlock: heading?.getAttribute(BLOCK_ATTR) ?? null,
        quote: heading?.textContent?.trim() ?? null,
        note: text,
      });
      setAnnotations((current) => [...current, created]);
      setNoteDraft('');
      setGeneralNoteOpen(false);
      showToast('Nota guardada');
    } catch {
      showToast('No se ha podido guardar la nota.');
    }
  };

  const scrollToBlock = useCallback((blockId: string | null, annotationId?: string) => {
    const root = articleRef.current;
    if (!root || !blockId) return;
    const target =
      (annotationId && root.querySelector<HTMLElement>(`mark[${MARK_ATTR}="${annotationId}"]`)) ||
      root.querySelector<HTMLElement>(`[${BLOCK_ATTR}="${blockId}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const marks = annotationId ? Array.from(root.querySelectorAll(`mark[${MARK_ATTR}="${annotationId}"]`)) : [];
    marks.forEach((m) => m.classList.add('sr-flash'));
    window.setTimeout(() => marks.forEach((m) => m.classList.remove('sr-flash')), 1600);
  }, []);

  const goToAnnotation = (annotation: StudyAnnotation) => {
    setPanel(null);
    if (annotation.documentId !== document.id) {
      const doc = topic.documents.find((d) => d.id === annotation.documentId);
      if (doc) onNavigate({ code: topic.code, kind: doc.kind, anchor: null });
      return;
    }
    window.setTimeout(() => scrollToBlock(annotation.anchorBlock ?? annotation.spans[0]?.b ?? null, annotation.id), 60);
  };

  const onArticleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement;
    const link = element.closest('a[data-study-link]') as HTMLAnchorElement | null;
    if (link) {
      event.preventDefault();
      const target = resolveStudyLink(link.getAttribute('href'));
      if (target.type === 'anchor') {
        const heading = articleRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(target.anchor)}"]`);
        heading?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else if (target.type === 'document') {
        if (topics.some((t) => t.code === target.code))
          onNavigate({
            code: target.code,
            kind: target.kind,
            anchor: target.anchor,
          });
      }
      return;
    }
    const mark = element.closest(`mark[${MARK_ATTR}]`) as HTMLElement | null;
    if (mark && window.getSelection()?.isCollapsed !== false) {
      const id = mark.getAttribute(MARK_ATTR) as string;
      const annotation = annotations.find((a) => a.id === id);
      setNoteDraft(annotation?.note ?? '');
      setOpenAnnotation({
        id,
        rect: mark.getBoundingClientRect(),
        editingNote: false,
      });
    }
  };

  const toggleCompleted = async () => {
    const isDone = Boolean(progress[document.id]?.completedAt && progress[document.id]?.versionId === version.id);
    await flushProgress(!isDone);
    setProgress((current) => ({
      ...current,
      [document.id]: {
        documentId: document.id,
        versionId: version.id,
        progress: !isDone ? 1 : maxRatioRef.current,
        lastBlock: lastBlockRef.current,
        completedAt: !isDone ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
    }));
    showToast(!isDone ? 'Marcado como estudiado' : 'Marcado como pendiente');
  };

  const isCompleted = Boolean(progress[document.id]?.completedAt && progress[document.id]?.versionId === version.id);
  const openAnn = openAnnotation ? (annotations.find((a) => a.id === openAnnotation.id) ?? null) : null;
  const topicAnnotations = annotations;
  const notesCount = topicAnnotations.length;

  const toolbarStyle = (rect: DOMRect | null): React.CSSProperties => {
    if (!rect) return { left: '50%', bottom: 24, transform: 'translateX(-50%)' };
    const width = 300;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    const above = rect.top > 140;
    const top = above ? rect.top - 58 : rect.bottom + 10;
    return {
      left,
      top: Math.max(8, Math.min(window.innerHeight - 72, top)),
      width,
    };
  };

  const tocList = (
    <nav aria-label="Índice del documento" className="space-y-0.5 text-sm">
      {toc.length === 0 ? <p className="px-2 text-[color:var(--sr-muted)]">Sin apartados</p> : null}
      {toc.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          onClick={(event) => {
            event.preventDefault();
            setPanel(null);
            articleRef.current
              ?.querySelector<HTMLElement>(`[id="${CSS.escape(entry.id)}"]`)
              ?.scrollIntoView({ block: 'start' });
          }}
          className={`block rounded-lg px-2 py-1.5 leading-snug transition-colors ${entry.level === 3 ? 'pl-5 text-[13px]' : 'font-semibold'} ${
            activeHeading === entry.id
              ? 'bg-[color:var(--sr-surface)] text-[color:var(--sr-accent)]'
              : 'text-[color:var(--sr-muted)] hover:text-[color:var(--sr-text)]'
          }`}
        >
          {entry.text}
        </a>
      ))}
    </nav>
  );

  const notesList = (
    <div className="space-y-3">
      <div className="rounded-xl border border-[color:var(--sr-border)] p-3">
        {generalNoteOpen ? (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[color:var(--sr-muted)]" htmlFor="sr-general-note">
              Nota en «{toc.find((t) => t.id === activeHeading)?.text ?? DOCUMENT_KIND_LABEL[document.kind]}»
            </label>
            <textarea
              id="sr-general-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              maxLength={20000}
              className="w-full rounded-lg border border-[color:var(--sr-border)] bg-[color:var(--sr-bg)] p-2 text-sm text-[color:var(--sr-text)]"
              placeholder="Escribe tu nota…"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGeneralNoteOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[color:var(--sr-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addGeneralNote}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-bold text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNoteDraft('');
              setGeneralNoteOpen(true);
            }}
            className="flex w-full items-center gap-2 text-sm font-bold text-[color:var(--sr-accent)]"
          >
            <MessageSquarePlus size={16} aria-hidden="true" /> Añadir nota en este apartado
          </button>
        )}
      </div>
      {notesCount === 0 ? (
        <p className="text-sm text-[color:var(--sr-muted)]">
          Selecciona texto para subrayarlo o añadir una nota. Aquí verás todo lo que marques en este tema.
        </p>
      ) : null}
      {topic.documents.map((doc) => {
        const items = topicAnnotations.filter((a) => a.documentId === doc.id);
        if (items.length === 0) return null;
        return (
          <section key={doc.id}>
            <h3 className="mb-1.5 text-xs font-black uppercase tracking-wide text-[color:var(--sr-muted)]">
              {DOCUMENT_KIND_LABEL[doc.kind]} · {items.length}
            </h3>
            <ul className="space-y-2">
              {items.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => goToAnnotation(a)}
                    className="w-full rounded-xl border border-[color:var(--sr-border)] p-2.5 text-left hover:bg-[color:var(--sr-surface)]"
                  >
                    <span className="flex items-start gap-2">
                      {a.kind === 'note' ? (
                        <StickyNote
                          size={14}
                          className="mt-0.5 shrink-0 text-[color:var(--sr-accent)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_DOT[a.color ?? 'yellow']}`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0">
                        {a.quote ? (
                          <span className="line-clamp-3 text-[13px] leading-snug text-[color:var(--sr-text)]">
                            {a.kind === 'note' ? <b>{a.quote}</b> : `«${a.quote}»`}
                          </span>
                        ) : null}
                        {a.note ? (
                          <span className="mt-1 block whitespace-pre-wrap text-[13px] text-[color:var(--sr-muted)]">
                            {a.note}
                          </span>
                        ) : null}
                        {orphanIds.has(a.id) && a.documentId === document.id ? (
                          <span className="mt-1 block text-[11px] font-semibold text-amber-600">
                            De una versión anterior: este texto ya no está igual en la versión actual.
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );

  const settingsPanel = (
    <div className="space-y-5 text-sm">
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-[color:var(--sr-muted)]">Tamaño de letra</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Letra más pequeña"
            disabled={prefs.size === 0}
            onClick={() => setPrefs({ ...prefs, size: Math.max(0, prefs.size - 1) })}
            className="h-10 w-10 rounded-xl border border-[color:var(--sr-border)] text-sm font-bold disabled:opacity-40"
          >
            A−
          </button>
          <span className="flex-1 text-center font-semibold">{FONT_SIZES[prefs.size]} px</span>
          <button
            type="button"
            aria-label="Letra más grande"
            disabled={prefs.size === FONT_SIZES.length - 1}
            onClick={() =>
              setPrefs({
                ...prefs,
                size: Math.min(FONT_SIZES.length - 1, prefs.size + 1),
              })
            }
            className="h-10 w-10 rounded-xl border border-[color:var(--sr-border)] text-lg font-bold disabled:opacity-40"
          >
            A+
          </button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-[color:var(--sr-muted)]">Tipo de letra</p>
        <div className="grid grid-cols-2 gap-2">
          {(['serif', 'sans'] as const).map((font) => (
            <button
              key={font}
              type="button"
              aria-pressed={prefs.font === font}
              onClick={() => setPrefs({ ...prefs, font })}
              className={`rounded-xl border px-3 py-2 ${prefs.font === font ? 'border-[color:var(--sr-accent)] font-bold text-[color:var(--sr-accent)]' : 'border-[color:var(--sr-border)]'}`}
              style={{
                fontFamily: font === 'serif' ? 'Georgia, serif' : 'Inter, system-ui, sans-serif',
              }}
            >
              {font === 'serif' ? 'Clásica' : 'Moderna'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-[color:var(--sr-muted)]">Ancho del texto</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['normal', 'Normal'],
              ['amplio', 'Amplio'],
              ['completo', 'Completo'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={prefs.width === id}
              onClick={() => setPrefs({ ...prefs, width: id })}
              className={`rounded-xl border px-2 py-2 ${prefs.width === id ? 'border-[color:var(--sr-accent)] font-bold text-[color:var(--sr-accent)]' : 'border-[color:var(--sr-border)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-[color:var(--sr-muted)]">Fondo</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['light', 'Claro', '#ffffff', '#1e293b'],
              ['sepia', 'Sepia', '#f7f2e7', '#3b3226'],
              ['dark', 'Oscuro', '#0f172a', '#e2e8f0'],
            ] as const
          ).map(([id, label, bg, fg]) => (
            <button
              key={id}
              type="button"
              aria-pressed={prefs.theme === id}
              onClick={() => setPrefs({ ...prefs, theme: id })}
              className={`rounded-xl border-2 px-2 py-2 font-semibold ${prefs.theme === id ? 'border-indigo-500' : 'border-transparent'}`}
              style={{ background: bg, color: fg }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const progressFor = (docId: string) => {
    const p = progress[docId];
    if (!p) return 0;
    if (p.completedAt) return 1;
    return p.progress;
  };

  return (
    <div
      className="study-reader fixed inset-0 z-[60] flex flex-col"
      data-theme={prefs.theme}
      data-font={prefs.font}
      data-width={prefs.width}
      style={{ ['--sr-font-size' as string]: `${FONT_SIZES[prefs.size]}px` }}
      role="dialog"
      aria-modal="true"
      aria-label={`Tema ${topic.topicNumber}. ${topic.title}`}
    >
      {/* Barra superior */}
      <header
        className="study-reader-chrome z-20 border-b border-[color:var(--sr-border)]"
        style={{ background: 'var(--sr-bg)' }}
      >
        <div
          className="flex w-full items-center gap-2 px-3 pt-2 sm:px-5"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-bold hover:bg-[color:var(--sr-surface)]"
            aria-label="Volver al temario"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Temario</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-[color:var(--sr-accent)]">
              Tema {topic.topicNumber}
              {version.status === 'draft' ? (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                  Borrador · solo revisión
                </span>
              ) : null}
            </p>
            <p className="truncate text-sm font-bold sm:text-[15px]" title={topic.title}>
              {topic.title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[color:var(--sr-surface)] lg:hidden"
            aria-label="Índice"
          >
            <List size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === 'notes' ? null : 'notes')}
            className="relative inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold hover:bg-[color:var(--sr-surface)]"
            aria-label="Mis subrayados y notas"
          >
            <NotebookPen size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Mis notas</span>
            {notesCount > 0 ? (
              <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] font-black text-white">{notesCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[color:var(--sr-surface)]"
            aria-label="Ajustes de lectura"
          >
            <Type size={18} aria-hidden="true" />
          </button>
        </div>
        <div
          className="flex w-full gap-1 overflow-x-auto px-3 pb-2 pt-1.5 sm:px-5"
          role="tablist"
          aria-label="Partes del tema"
        >
          {topic.documents.map((doc) => {
            const selected = doc.id === document.id;
            const pct = Math.round(progressFor(doc.id) * 100);
            return (
              <button
                key={doc.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => !selected && onNavigate({ code: topic.code, kind: doc.kind, anchor: null })}
                className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                  selected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[color:var(--sr-surface)] text-[color:var(--sr-muted)] hover:text-[color:var(--sr-text)]'
                }`}
              >
                {DOCUMENT_KIND_LABEL[doc.kind]}
                {pct >= 100 ? <Check size={13} className="ml-1 inline" aria-label="estudiado" /> : null}
              </button>
            );
          })}
        </div>
        <div className="h-0.5 w-full bg-transparent" aria-hidden="true">
          <div
            className="h-full bg-indigo-500 transition-[width] duration-150"
            style={{ width: `${Math.round(readRatio * 100)}%` }}
          />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Índice lateral (escritorio) */}
        <aside className="study-reader-chrome hidden w-[280px] shrink-0 overflow-y-auto xl:w-[320px] 2xl:w-[360px] border-r border-[color:var(--sr-border)] px-3 py-5 lg:block">
          <p className="mb-2 px-2 text-xs font-black uppercase tracking-wide text-[color:var(--sr-muted)]">
            {DOCUMENT_KIND_LABEL[document.kind]}
          </p>
          {tocList}
        </aside>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="study-column mx-auto w-full px-4 pb-28 pt-6 sm:px-8 sm:pt-10 lg:px-12 2xl:px-16">
            {resumeBlock ? (
              <div className="study-reader-chrome mb-6 flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <span>Lo dejaste a medias. ¿Sigues por donde ibas?</span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" className="font-bold" onClick={() => setResumeBlock(null)}>
                    No
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-indigo-600 px-3 py-1 font-bold text-white"
                    onClick={() => {
                      scrollToBlock(resumeBlock);
                      setResumeBlock(null);
                    }}
                  >
                    Continuar
                  </button>
                </span>
              </div>
            ) : null}

            <p className="study-reader-chrome text-xs font-black uppercase tracking-wider text-[color:var(--sr-muted)]">
              {DOCUMENT_KIND_LABEL[document.kind]} · v{version.version}
              {version.versionDate ? ` · ${formatDate(version.versionDate)}` : ''}
            </p>
            <h1 className="mt-1 font-[Inter,system-ui,sans-serif] text-2xl font-black leading-tight tracking-tight sm:text-[2rem]">
              Tema {topic.topicNumber}. {topic.title}
            </h1>
            {document.kind === 'manual' && (version.normativeNote || version.sourcesNote) ? (
              <dl className="mt-5 grid gap-2 rounded-2xl border border-[color:var(--sr-border)] bg-[color:var(--sr-surface)] p-4 text-[13px] leading-relaxed">
                {version.normativeNote ? (
                  <div>
                    <dt className="font-black text-[color:var(--sr-muted)]">Normativa de referencia</dt>
                    <dd>{version.normativeNote}</dd>
                  </div>
                ) : null}
                {version.sourcesNote ? (
                  <div>
                    <dt className="font-black text-[color:var(--sr-muted)]">Fuentes</dt>
                    <dd>{version.sourcesNote}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {loadError ? (
              <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                No se ha podido cargar el documento. {loadError}
                <button
                  type="button"
                  className="ml-2 font-bold underline"
                  onClick={() =>
                    onNavigate({
                      code: topic.code,
                      kind: document.kind,
                      anchor,
                    })
                  }
                >
                  Reintentar
                </button>
              </div>
            ) : body === null ? (
              <div className="mt-8 space-y-3" aria-busy="true" aria-label="Cargando">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 animate-pulse rounded bg-[color:var(--sr-surface)]"
                    style={{ width: `${70 + ((i * 13) % 30)}%` }}
                  />
                ))}
              </div>
            ) : (
              <article ref={articleRef} key={version.id} className="study-prose mt-8" onClick={onArticleClick}>
                <MarkdownBody body={body} />
              </article>
            )}

            {body !== null ? (
              <footer className="study-reader-chrome mt-14 space-y-4 border-t border-[color:var(--sr-border)] pt-8">
                <button
                  type="button"
                  onClick={toggleCompleted}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black transition-colors ${
                    isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <BookOpenCheck size={18} aria-hidden="true" />
                  {isCompleted ? 'Estudiado · marcar como pendiente' : 'Marcar como estudiado'}
                </button>
                <div className="grid gap-2 sm:grid-cols-2">
                  {nextDocument ? (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          code: topic.code,
                          kind: nextDocument.kind,
                          anchor: null,
                        })
                      }
                      className="flex items-center justify-between rounded-2xl border border-[color:var(--sr-border)] px-4 py-3 text-left text-sm font-bold sm:col-span-2"
                    >
                      <span>
                        <span className="block text-xs font-semibold text-[color:var(--sr-muted)]">Siguiente</span>
                        {DOCUMENT_KIND_LABEL[nextDocument.kind]}
                      </span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                  {previousTopic ? (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          code: previousTopic.code,
                          kind: 'manual',
                          anchor: null,
                        })
                      }
                      className="flex items-center gap-2 rounded-2xl border border-[color:var(--sr-border)] px-4 py-3 text-left text-sm font-bold"
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[color:var(--sr-muted)]">Tema anterior</span>
                        <span className="block truncate">Tema {previousTopic.topicNumber}</span>
                      </span>
                    </button>
                  ) : (
                    <span />
                  )}
                  {nextTopic ? (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          code: nextTopic.code,
                          kind: 'manual',
                          anchor: null,
                        })
                      }
                      className="flex items-center justify-end gap-2 rounded-2xl border border-[color:var(--sr-border)] px-4 py-3 text-right text-sm font-bold"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[color:var(--sr-muted)]">Tema siguiente</span>
                        <span className="block truncate">Tema {nextTopic.topicNumber}</span>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </footer>
            ) : null}
          </div>
        </div>

        {/* Panel lateral: índice (móvil), notas o ajustes */}
        {panel ? (
          <>
            <button
              type="button"
              aria-label="Cerrar panel"
              className="study-reader-chrome fixed inset-0 z-30 bg-black/30 lg:hidden"
              onClick={() => setPanel(null)}
            />
            <aside
              className={`study-reader-chrome fixed inset-y-0 right-0 z-40 flex w-[min(380px,92vw)] flex-col border-l border-[color:var(--sr-border)] bg-[color:var(--sr-bg)] shadow-2xl lg:static lg:z-auto lg:w-[340px] lg:shadow-none ${
                panel === 'toc' ? 'lg:hidden' : ''
              }`}
              aria-label={
                panel === 'toc' ? 'Índice' : panel === 'notes' ? 'Mis subrayados y notas' : 'Ajustes de lectura'
              }
            >
              <div
                className="flex items-center justify-between border-b border-[color:var(--sr-border)] px-4 py-3"
                style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
              >
                <p className="text-sm font-black">
                  {panel === 'toc' ? 'Índice' : panel === 'notes' ? 'Mis subrayados y notas' : 'Ajustes de lectura'}
                </p>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[color:var(--sr-surface)]"
                  aria-label="Cerrar"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto p-4"
                style={{
                  paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                }}
              >
                {panel === 'toc' ? tocList : panel === 'notes' ? notesList : settingsPanel}
              </div>
            </aside>
          </>
        ) : null}
      </div>

      {/* Barra de selección */}
      {selection ? (
        <div
          className="study-reader-chrome fixed z-[70] flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl"
          style={toolbarStyle(selection.rect)}
          onMouseDown={(e) => e.preventDefault()}
          role="toolbar"
          aria-label="Subrayar selección"
        >
          {COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              disabled={busy}
              onClick={() => addHighlight(color.id, false)}
              className={`h-8 w-8 rounded-full ${color.swatch} ring-offset-1 hover:ring-2 hover:ring-slate-400`}
              aria-label={`Subrayar en ${color.label.toLowerCase()}`}
              title={`Subrayar en ${color.label.toLowerCase()}`}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
          <button
            type="button"
            disabled={busy}
            onClick={() => addHighlight('yellow', true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Subrayar y añadir nota"
            title="Añadir nota"
          >
            <MessageSquarePlus size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(selection.quote).then(() => showToast('Copiado'));
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Copiar"
            title="Copiar"
          >
            <Copy size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Detalle de un subrayado */}
      {openAnnotation && openAnn ? (
        <div
          className="study-reader-chrome fixed z-[70] w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl"
          style={toolbarStyle(openAnnotation.rect)}
          role="dialog"
          aria-label="Subrayado"
        >
          <div className="flex items-center gap-1">
            {COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() => patchAnnotation(openAnn.id, { color: color.id })}
                className={`h-7 w-7 rounded-full ${color.swatch} ${openAnn.color === color.id ? 'ring-2 ring-slate-500 ring-offset-1' : ''}`}
                aria-label={`Cambiar a ${color.label.toLowerCase()}`}
                aria-pressed={openAnn.color === color.id}
              />
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => removeAnnotation(openAnn.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
              aria-label="Borrar subrayado"
              title="Borrar"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setOpenAnnotation(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {openAnnotation.editingNote ? (
            <div className="mt-2 space-y-2">
              <textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                maxLength={20000}
                className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                placeholder="Tu nota sobre este texto…"
                aria-label="Nota"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenAnnotation({ ...openAnnotation, editingNote: false })}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      await patchAnnotation(openAnn.id, {
                        note: noteDraft.trim() || null,
                      })
                    )
                      setOpenAnnotation(null);
                  }}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-bold text-white"
                >
                  Guardar nota
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNoteDraft(openAnn.note ?? '');
                setOpenAnnotation({ ...openAnnotation, editingNote: true });
              }}
              className="mt-2 block w-full rounded-lg bg-slate-50 p-2 text-left text-sm hover:bg-slate-100"
            >
              {openAnn.note ? (
                <span className="whitespace-pre-wrap">{openAnn.note}</span>
              ) : (
                <span className="font-semibold text-indigo-600">+ Añadir nota</span>
              )}
            </button>
          )}
        </div>
      ) : null}

      {toast ? (
        <div
          className="study-reader-chrome pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4"
          role="status"
        >
          <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {toast}
          </span>
        </div>
      ) : null}
    </div>
  );
}
