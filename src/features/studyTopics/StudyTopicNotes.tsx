import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Library, StickyNote } from 'lucide-react';
import { listAllStudyAnnotations, listStudyTopics } from './studyTopicsApi';
import { openStudyRoute } from './route';
import { DOCUMENT_KIND_LABEL, type AnnotationColor, type StudyAnnotation, type StudyTopicSummary } from './types';

const DOT: Record<AnnotationColor, string> = {
  yellow: 'bg-yellow-300',
  green: 'bg-green-300',
  blue: 'bg-blue-300',
  pink: 'bg-pink-300',
  orange: 'bg-orange-300',
};

interface Props {
  curriculum: string;
  /** Cambia la vista de la plataforma al Temario. */
  onOpenTemario: () => void;
}

/** Subrayados y notas del temario dentro de «Mis notas y subrayados», agrupados por tema. */
export default function StudyTopicNotes({ curriculum, onOpenTemario }: Props) {
  const [topics, setTopics] = useState<StudyTopicSummary[] | null>(null);
  const [annotations, setAnnotations] = useState<StudyAnnotation[] | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([listStudyTopics(curriculum), listAllStudyAnnotations()])
      .then(([t, a]) => {
        if (cancelled) return;
        setTopics(t);
        setAnnotations(a);
      })
      .catch(() => {
        if (!cancelled) {
          setTopics([]);
          setAnnotations([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [curriculum]);

  const groups = useMemo(() => {
    if (!topics || !annotations) return [];
    const docIndex = new Map<string, { topic: StudyTopicSummary; kind: StudyTopicSummary['documents'][number]['kind'] }>();
    topics.forEach((topic) => topic.documents.forEach((doc) => docIndex.set(doc.id, { topic, kind: doc.kind })));
    const q = query.trim().toLowerCase();
    return topics
      .map((topic) => ({
        topic,
        items: annotations
          .filter((a) => docIndex.get(a.documentId)?.topic.id === topic.id && a.kind !== 'bookmark')
          .filter((a) => !q || `${a.quote ?? ''} ${a.note ?? ''}`.toLowerCase().includes(q))
          .map((a) => ({ annotation: a, kind: docIndex.get(a.documentId)!.kind })),
      }))
      .filter((group) => group.items.length > 0);
  }, [topics, annotations, query]);

  if (!topics || !annotations) return null;
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  const go = (topic: StudyTopicSummary, a: StudyAnnotation, kind: StudyTopicSummary['documents'][number]['kind']) => {
    onOpenTemario();
    openStudyRoute({ topicNumber: topic.topicNumber, kind, anchor: null, annotationId: a.id });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Library size={18} className="text-indigo-600" aria-hidden="true" /> Del temario
          </h2>
          <p className="text-sm text-slate-500">
            {annotations.length
              ? `${annotations.length} subrayados y notas en ${groups.length} temas. Toca uno para abrir el tema justo ahí.`
              : 'Cuando subrayes o anotes en el temario, lo verás aquí agrupado por tema.'}
          </p>
        </div>
        {annotations.length > 5 ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en mis subrayados"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:w-64 sm:text-sm"
          />
        ) : null}
      </div>
      {total > 0 ? (
        <div className="mt-4 space-y-4">
          {groups.map(({ topic, items }) => {
            const open = expanded[topic.id] || items.length <= 4 || Boolean(query);
            const shown = open ? items : items.slice(0, 4);
            return (
              <div key={topic.id}>
                <h3 className="mb-1.5 text-sm font-black text-slate-800">
                  Tema {topic.topicNumber}. <span className="font-semibold text-slate-600">{topic.title}</span>
                </h3>
                <ul className="grid gap-2 md:grid-cols-2">
                  {shown.map(({ annotation: a, kind }) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => go(topic, a, kind)}
                        className="flex w-full items-start gap-2 rounded-xl border border-slate-200 p-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
                      >
                        {a.kind === 'note' ? (
                          <StickyNote size={14} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
                        ) : (
                          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[a.color ?? 'yellow']}`} aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            {DOCUMENT_KIND_LABEL[kind]}
                          </span>
                          {a.quote ? (
                            <span className="line-clamp-3 text-[13px] leading-snug text-slate-800">
                              {a.kind === 'note' ? <b>{a.quote}</b> : `«${a.quote}»`}
                            </span>
                          ) : null}
                          {a.note ? (
                            <span className="mt-1 block whitespace-pre-wrap text-[13px] text-slate-500">{a.note}</span>
                          ) : null}
                        </span>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                {!open ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [topic.id]: true }))}
                    className="mt-1.5 text-xs font-bold text-indigo-600"
                  >
                    Ver los {items.length}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : query ? (
        <p className="mt-3 text-sm text-slate-500">Nada coincide con «{query}».</p>
      ) : null}
    </section>
  );
}
