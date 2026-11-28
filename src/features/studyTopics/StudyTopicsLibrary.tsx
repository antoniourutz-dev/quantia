import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, ChevronRight, Loader2, RotateCcw, Search } from 'lucide-react';
import StudyTopicReader, { type ReaderLocation } from './StudyTopicReader';
import { listStudyProgress, listStudyTopics } from './studyTopicsApi';
import { topicState, type TopicState } from './progress';
import { formatStudyHash, parseStudyHash } from './route';
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KIND_SHORT,
  STUDY_WORDS_PER_MINUTE,
  formatMinutes,
  readingMinutes,
  type StudyProgress,
  type StudyTopicSummary,
} from './types';

interface Props {
  curriculum: string;
  userId: string;
}

const LAST_KEY = 'quantia.studyReader.last.v1';
const FILTER_KEY = 'quantia.studyTopics.filter.v1';
const REVIEW_AFTER_DAYS = 7;

type Filter = 'todos' | 'curso' | 'pendientes' | 'estudiados';
const FILTERS: Array<[Filter, string]> = [
  ['todos', 'Todos'],
  ['curso', 'En curso'],
  ['pendientes', 'Sin empezar'],
  ['estudiados', 'Estudiados'],
];

const readLast = (userId: string): ReaderLocation | null => {
  try {
    const raw = window.localStorage.getItem(`${LAST_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as ReaderLocation) : null;
  } catch {
    return null;
  }
};

const readFilter = (): Filter => {
  try {
    const value = window.localStorage.getItem(FILTER_KEY);
    return FILTERS.some(([id]) => id === value) ? (value as Filter) : 'todos';
  } catch {
    return 'todos';
  }
};

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const daysSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 86_400_000 : 0);

export default function StudyTopicsLibrary({ curriculum, userId }: Props) {
  const [topics, setTopics] = useState<StudyTopicSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, StudyProgress>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilterState] = useState<Filter>(readFilter);
  const [location, setLocation] = useState<ReaderLocation | null>(null);
  const [last, setLast] = useState<ReaderLocation | null>(() => readLast(userId));
  /** Si abrimos el lector añadiendo una entrada al historial (Atrás debe cerrarlo). */
  const pushedRef = useRef(false);

  const setFilter = (value: Filter) => {
    setFilterState(value);
    try {
      window.localStorage.setItem(FILTER_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(() => {
    setError(null);
    listStudyTopics(curriculum)
      .then(setTopics)
      .catch((e: Error) => setError(e.message));
  }, [curriculum]);

  useEffect(load, [load]);

  const refreshProgress = useCallback(() => {
    listStudyProgress()
      .then((rows) => {
        const map: Record<string, StudyProgress> = {};
        rows.forEach((row) => (map[row.documentId] = row));
        setProgress(map);
      })
      .catch(() => undefined);
  }, []);
  useEffect(refreshProgress, [refreshProgress]);

  const remember = (next: ReaderLocation) => {
    const { code, kind } = next;
    setLast({ code, kind, anchor: null });
    try {
      window.localStorage.setItem(`${LAST_KEY}:${userId}`, JSON.stringify({ code, kind, anchor: null }));
    } catch {
      /* ignore */
    }
  };

  const hashFor = useCallback(
    (loc: ReaderLocation) => {
      const topic = topics?.find((t) => t.code === loc.code);
      return topic
        ? formatStudyHash({
            topicNumber: topic.topicNumber,
            kind: loc.kind,
            anchor: loc.anchor,
            annotationId: loc.annotationId ?? null,
          })
        : null;
    },
    [topics],
  );

  /** Abre (o cambia de documento dentro del lector) y lo refleja en la dirección. */
  const open = (next: ReaderLocation) => {
    const hash = hashFor(next);
    if (hash) {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      if (location) window.history.replaceState(window.history.state, '', url);
      else {
        window.history.pushState({ quantiaReader: true }, '', url);
        pushedRef.current = true;
      }
    }
    setLocation(next);
    remember(next);
  };

  const close = () => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back(); // popstate cierra el lector
      return;
    }
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    setLocation(null);
    refreshProgress();
  };

  // La dirección manda: al cargar con #temario/…, con Atrás/Adelante o desde «Mis notas».
  useEffect(() => {
    if (!topics) return;
    const sync = () => {
      const route = parseStudyHash(window.location.hash);
      const topic = route ? topics.find((t) => t.topicNumber === route.topicNumber) : null;
      if (route && topic) {
        const kind = topic.documents.some((d) => d.kind === route.kind) ? route.kind : topic.documents[0].kind;
        const next = { code: topic.code, kind, anchor: route.anchor, annotationId: route.annotationId };
        setLocation(next);
        remember(next);
      } else {
        pushedRef.current = false;
        setLocation((current) => {
          if (current) refreshProgress();
          return null;
        });
      }
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, [topics]);

  const states = useMemo(() => {
    const map: Record<string, TopicState> = {};
    (topics ?? []).forEach((t) => (map[t.id] = topicState(t, progress)));
    return map;
  }, [topics, progress]);

  const counts = useMemo(() => {
    const list = topics ?? [];
    return {
      todos: list.length,
      curso: list.filter((t) => states[t.id]?.started && !states[t.id]?.done).length,
      pendientes: list.filter((t) => !states[t.id]?.started).length,
      estudiados: list.filter((t) => states[t.id]?.done).length,
    } satisfies Record<Filter, number>;
  }, [topics, states]);

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = normalize(query.trim());
    return topics.filter((t) => {
      const st = states[t.id];
      if (filter === 'curso' && !(st?.started && !st.done)) return false;
      if (filter === 'pendientes' && st?.started) return false;
      if (filter === 'estudiados' && !st?.done) return false;
      if (!q) return true;
      return normalize(`tema ${t.topicNumber} ${t.title}`).includes(q) || String(t.topicNumber) === q;
    });
  }, [topics, query, filter, states]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        No se ha podido cargar el temario. {error}
        <button type="button" onClick={load} className="ml-2 font-bold underline">
          Reintentar
        </button>
      </div>
    );
  }

  if (!topics) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando temario…
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Todavía no hay temas publicados para esta oposición.
      </div>
    );
  }

  const activeTopic = location ? (topics.find((t) => t.code === location.code) ?? null) : null;
  // «Seguir»: lo último abierto en este dispositivo; si no hay, el tema con actividad más reciente sin terminar.
  const recent = [...topics]
    .filter((t) => states[t.id]?.lastActivity && !states[t.id]?.done)
    .sort((a, b) => (states[b.id]?.lastActivity ?? '').localeCompare(states[a.id]?.lastActivity ?? ''))[0];
  const resumeAt: ReaderLocation | null =
    last ??
    (recent
      ? {
          code: recent.code,
          kind: recent.documents.find((d) => progress[d.id] && !progress[d.id].completedAt)?.kind ?? recent.documents[0].kind,
          anchor: null,
        }
      : null);
  const lastTopic = resumeAt ? (topics.find((t) => t.code === resumeAt.code) ?? null) : null;
  const firstPending = topics.find((t) => !states[t.id]?.started) ?? topics[0];
  const totalWords = topics.reduce((sum, t) => sum + (states[t.id]?.totalWords ?? 0), 0);
  const readWords = topics.reduce((sum, t) => sum + (states[t.id]?.totalWords ?? 0) - (states[t.id]?.remainingWords ?? 0), 0);
  const overall = totalWords ? readWords / totalWords : 0;
  const remaining = Math.round((totalWords - readWords) / STUDY_WORDS_PER_MINUTE);
  // Para repasar: temas estudiados hace más de una semana, los más antiguos primero.
  const toReview = topics
    .filter((t) => states[t.id]?.done && daysSince(states[t.id]?.completedAt ?? null) >= REVIEW_AFTER_DAYS)
    .sort((a, b) => (states[a.id]?.completedAt ?? '').localeCompare(states[b.id]?.completedAt ?? ''))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Resumen y «seguir por aquí» en una sola franja */}
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-600">
              <b className="text-slate-900">
                {counts.estudiados} de {topics.length}
              </b>{' '}
              temas estudiados · <b className="text-slate-900">{Math.round(overall * 100)} %</b> leído
              <span className="hidden sm:inline"> · quedan unas {formatMinutes(remaining)} de lectura</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(overall * 100)}%` }} />
            </div>
          </div>
          {lastTopic && resumeAt ? (
            <button
              type="button"
              onClick={() => open({ ...resumeAt, anchor: null })}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-indigo-700"
            >
              <BookOpen size={16} aria-hidden="true" />
              Seguir: Tema {lastTopic.topicNumber} · {DOCUMENT_KIND_LABEL[resumeAt.kind]}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => open({ code: firstPending.code, kind: firstPending.documents[0].kind, anchor: null })}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-indigo-700"
            >
              <BookOpen size={16} aria-hidden="true" />
              Empezar por el tema {firstPending.topicNumber}
            </button>
          )}
        </div>
        {toReview.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold text-amber-700">
              <RotateCcw size={14} aria-hidden="true" /> Para repasar hoy:
            </span>
            {toReview.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => open({ code: t.code, kind: t.documents.find((d) => d.kind === 'repaso')?.kind ?? t.documents[0].kind, anchor: null })}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100"
              >
                Tema {t.topicNumber} · repaso exprés
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar tema</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número o título"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-base shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:text-sm"
          />
        </label>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:flex" role="group" aria-label="Filtrar temas">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`flex shrink-0 flex-col items-center rounded-lg px-1 py-1 text-[11px] font-bold leading-tight sm:flex-row sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-[13px] ${
                filter === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label} <span className={filter === id ? 'text-white/70' : 'text-slate-400'}>{counts[id]}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm min-[1800px]:grid-cols-2">
        {filtered.map((topic) => {
          const st = states[topic.id];
          const pct = Math.round((st?.read ?? 0) * 100);
          const minutes = readingMinutes(st?.totalWords ?? 0);
          const resume =
            last?.code === topic.code ? last.kind : (topic.documents.find((d) => !progress[d.id]?.completedAt)?.kind ?? topic.documents[0].kind);
          return (
            <li key={topic.id} className="group flex items-center gap-3 bg-white px-3 py-3 hover:bg-slate-50 sm:px-4">
              <button
                type="button"
                onClick={() => open({ code: topic.code, kind: resume, anchor: null })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                    st?.done ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {st?.done ? <Check size={18} aria-label="Estudiado" /> : topic.topicNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold leading-snug text-slate-900 line-clamp-2 sm:text-[15px]">
                    {st?.done ? `${topic.topicNumber}. ` : ''}
                    {topic.title}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-100 sm:w-24" aria-hidden="true">
                      <span className={`block h-full rounded-full ${st?.done ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                    </span>
                    <span className="font-semibold">{st?.done ? 'Estudiado' : `${pct} %`}</span>
                    <span>· {formatMinutes(minutes)}</span>
                    {st && st.doneCount > 0 && !st.done ? (
                      <span className="hidden sm:inline">
                        · {st.doneCount} de {topic.documents.length} partes estudiadas
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
              <div className="hidden shrink-0 flex-wrap justify-end gap-1 md:flex md:max-w-[22rem]">
                {topic.documents.map((doc) => {
                  const done = Boolean(progress[doc.id]?.completedAt && progress[doc.id]?.versionId === doc.current?.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => open({ code: topic.code, kind: doc.kind, anchor: null })}
                      title={DOCUMENT_KIND_LABEL[doc.kind]}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {done ? '✓ ' : ''}
                      {DOCUMENT_KIND_SHORT[doc.kind]}
                    </button>
                  );
                })}
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-300 md:hidden" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">
          {query ? `Ningún tema coincide con «${query}».` : 'No hay temas en este filtro.'}
        </p>
      ) : null}

      {activeTopic && location
        ? createPortal(
            <StudyTopicReader
              key={`${activeTopic.code}:${location.kind}`}
              topic={activeTopic}
              topics={topics}
              kind={location.kind}
              anchor={location.anchor}
              annotationId={location.annotationId ?? null}
              find={location.find ?? null}
              userId={userId}
              onNavigate={open}
              onClose={close}
            />,
            window.document.body,
          )
        : null}
    </div>
  );
}
