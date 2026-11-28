import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, Loader2, Search } from 'lucide-react';
import StudyTopicReader, { type ReaderLocation } from './StudyTopicReader';
import { listStudyProgress, listStudyTopics } from './studyTopicsApi';
import { DOCUMENT_KIND_LABEL, type StudyProgress, type StudyTopicSummary } from './types';

interface Props {
  curriculum: string;
  userId: string;
}

const LAST_KEY = 'quantia.studyReader.last.v1';

const readLast = (userId: string): ReaderLocation | null => {
  try {
    const raw = window.localStorage.getItem(`${LAST_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as ReaderLocation) : null;
  } catch {
    return null;
  }
};

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function StudyTopicsLibrary({ curriculum, userId }: Props) {
  const [topics, setTopics] = useState<StudyTopicSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, StudyProgress>>({});
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<ReaderLocation | null>(null);
  const [last, setLast] = useState<ReaderLocation | null>(() => readLast(userId));

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

  const open = (next: ReaderLocation) => {
    setLocation(next);
    setLast(next);
    try {
      window.localStorage.setItem(`${LAST_KEY}:${userId}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const close = () => {
    setLocation(null);
    refreshProgress();
  };

  const docProgress = (docId: string, versionId: string | undefined) => {
    const p = progress[docId];
    if (!p || p.versionId !== versionId) return 0;
    return p.completedAt ? 1 : p.progress;
  };

  const topicProgress = (topic: StudyTopicSummary) => {
    const values = topic.documents.map((d) => docProgress(d.id, d.current?.id));
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = normalize(query.trim());
    if (!q) return topics;
    return topics.filter(
      (t) => normalize(`tema ${t.topicNumber} ${t.title}`).includes(q) || String(t.topicNumber) === q,
    );
  }, [topics, query]);

  const activeTopic = location && topics ? (topics.find((t) => t.code === location.code) ?? null) : null;
  const lastTopic = last && topics ? (topics.find((t) => t.code === last.code) ?? null) : null;
  const hasDrafts = Boolean(topics?.some((t) => t.documents.some((d) => d.current?.status === 'draft')));
  const studied = topics ? topics.filter((t) => topicProgress(t) >= 0.999).length : 0;
  const overall = topics && topics.length ? topics.reduce((sum, t) => sum + topicProgress(t), 0) / topics.length : 0;

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

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-indigo-600">Temario</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              {topics.length} temas para estudiar
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {studied} de {topics.length} temas estudiados · {Math.round(overall * 100)} % del temario leído
            </p>
          </div>
          {lastTopic && last ? (
            <button
              type="button"
              onClick={() => open({ ...last, anchor: null })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700"
            >
              <BookOpen size={17} aria-hidden="true" />
              Continuar: Tema {lastTopic.topicNumber} · {DOCUMENT_KIND_LABEL[last.kind]}
            </button>
          ) : null}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(overall * 100)}%` }} />
        </div>
        {hasDrafts ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Estás viendo borradores pendientes de publicar. Los alumnos todavía no los ven.
          </p>
        ) : null}
      </section>

      <label className="relative block">
        <span className="sr-only">Buscar tema</span>
        <Search
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por número o título"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <ul className="grid gap-3 md:grid-cols-2">
        {filtered.map((topic) => {
          const pct = Math.round(topicProgress(topic) * 100);
          return (
            <li key={topic.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() =>
                  open({
                    code: topic.code,
                    kind: topic.documents[0].kind,
                    anchor: null,
                  })
                }
                className="flex flex-1 items-start gap-3 text-left"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                    pct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {pct >= 100 ? <Check size={18} aria-label="Estudiado" /> : topic.topicNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Tema {topic.topicNumber}
                  </span>
                  <span className="mt-0.5 block text-[15px] font-bold leading-snug text-slate-900 line-clamp-3">
                    {topic.title}
                  </span>
                </span>
              </button>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-bold text-slate-500">{pct} %</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topic.documents.map((doc) => {
                  const done = docProgress(doc.id, doc.current?.id) >= 0.999;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => open({ code: topic.code, kind: doc.kind, anchor: null })}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {done ? '✓ ' : ''}
                      {DOCUMENT_KIND_LABEL[doc.kind]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? <p className="text-sm text-slate-500">Ningún tema coincide con «{query}».</p> : null}

      {activeTopic && location
        ? createPortal(
            <StudyTopicReader
              key={`${activeTopic.code}:${location.kind}`}
              topic={activeTopic}
              topics={topics}
              kind={location.kind}
              anchor={location.anchor}
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
