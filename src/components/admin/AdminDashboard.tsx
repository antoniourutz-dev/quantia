import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Database, Loader2, Users } from 'lucide-react';
import { useAppLocale } from '../../lib/locale';
import type { CurriculumOption } from '../../lib/quantiaApi';
import { adminListUsers } from '../../lib/quantiaApi';
import { supabase } from '../../lib/supabaseClient';

type RangeKey = 'today' | '7d' | '30d';

const startOfTodayIso = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  return start.toISOString();
};

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export default function AdminDashboard({
  curriculumOptions,
  defaultCurriculum,
  onOpenStudents,
  onOpenQuestions,
  onOpenCatalogs,
}: {
  curriculumOptions: CurriculumOption[];
  defaultCurriculum: string;
  onOpenStudents: () => void;
  onOpenQuestions: () => void;
  onOpenCatalogs: () => void;
}) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const [range, setRange] = useState<RangeKey>('7d');
  const [curriculum, setCurriculum] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [usersTotal, setUsersTotal] = useState<number | null>(null);
  const [sessionsStarted, setSessionsStarted] = useState<number | null>(null);
  const [sessionsCompleted, setSessionsCompleted] = useState<number | null>(null);
  const [questionsTotal, setQuestionsTotal] = useState<number | null>(null);
  const [questionsNew, setQuestionsNew] = useState<number | null>(null);

  const fromIso = useMemo(() => {
    if (range === 'today') return startOfTodayIso();
    if (range === '30d') return isoDaysAgo(30);
    return isoDaysAgo(7);
  }, [range]);

  const refresh = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const users = await adminListUsers({ page: 1, perPage: 1 });
      setUsersTotal(users.total);

      const preguntasBase = supabase.from('preguntas').select('id', { count: 'exact', head: true });
      const preguntasQuery = curriculum ? preguntasBase.eq('curriculum', curriculum) : preguntasBase;
      const preguntasRes = await preguntasQuery;
      if (preguntasRes.error) throw new Error(preguntasRes.error.message);
      setQuestionsTotal(preguntasRes.count ?? null);

      const newQueryBase = supabase.from('preguntas').select('id', { count: 'exact', head: true }).gte('created_at', fromIso);
      const newQuery = curriculum ? newQueryBase.eq('curriculum', curriculum) : newQueryBase;
      const newRes = await newQuery;
      if (newRes.error) throw new Error(newRes.error.message);
      setQuestionsNew(newRes.count ?? null);

      try {
        const sessionsBase = supabase.schema('app').from('practice_sessions');
        const startedQ = sessionsBase.select('id', { count: 'exact', head: true }).gte('started_at', fromIso);
        const completedQ = sessionsBase.select('id', { count: 'exact', head: true }).gte('finished_at', fromIso);
        const startedRes = await (curriculum ? startedQ.eq('curriculum', curriculum) : startedQ);
        const completedRes = await (curriculum ? completedQ.eq('curriculum', curriculum) : completedQ);
        setSessionsStarted(startedRes.error ? null : startedRes.count ?? null);
        setSessionsCompleted(completedRes.error ? null : completedRes.count ?? null);
      } catch {
        setSessionsStarted(null);
        setSessionsCompleted(null);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('No se ha podido cargar el dashboard.', 'Ezin izan da dashboarda kargatu.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurriculum(defaultCurriculum);
  }, [defaultCurriculum]);

  useEffect(() => {
    void refresh();
  }, [range, curriculum]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Workspace admin', 'Admin workspace')}</div>
          <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{t('Dashboard admin', 'Admin panela')}</h2>
          <div className="mt-2 text-sm font-medium text-slate-500">{t('Lectura ejecutiva del estado de la app.', 'App-aren egoeraren irakurketa exekutiboa.')}</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
          >
            <option value="today">{t('Hoy', 'Gaur')}</option>
            <option value="7d">{t('7 días', '7 egun')}</option>
            <option value="30d">{t('30 días', '30 egun')}</option>
          </select>
          <select
            value={curriculum}
            onChange={(e) => setCurriculum(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
          >
            {curriculumOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenStudents}
            className="h-11 rounded-2xl bg-white border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all inline-flex items-center gap-2"
          >
            <Users size={16} />
            {t('Alumnos', 'Ikasleak')}
          </button>
          <button
            type="button"
            onClick={onOpenQuestions}
            className="h-11 rounded-2xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all inline-flex items-center gap-2"
          >
            <Database size={16} />
            {t('Preguntas', 'Galderak')}
          </button>
          <button
            type="button"
            onClick={onOpenCatalogs}
            className="h-11 rounded-2xl bg-white border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all inline-flex items-center gap-2"
          >
            <Database size={16} />
            {t('Catálogos', 'Katalogoak')}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t('Usuarios totales', 'Erabiltzaileak'), value: usersTotal, icon: Users },
          { label: t('Sesiones iniciadas', 'Hasitako saioak'), value: sessionsStarted, icon: BarChart3 },
          { label: t('Sesiones completadas', 'Amaitutako saioak'), value: sessionsCompleted, icon: BarChart3 },
          { label: t('Preguntas totales', 'Galderak'), value: questionsTotal, icon: Database },
        ].map((card) => (
          <div key={card.label} className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{card.label}</div>
              <card.icon size={18} className="text-slate-400" />
            </div>
            <div className="mt-3 text-4xl font-black text-slate-900">
              {loading ? <Loader2 className="h-7 w-7 animate-spin text-slate-400" /> : card.value ?? '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Contenido', 'Edukia')}</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{t('Preguntas nuevas', 'Galdera berriak')}</div>
            <div className="mt-1 text-sm font-medium text-slate-500">
              {t('Nuevas creadas desde el rango seleccionado.', 'Hautatutako tartean sortutako berriak.')}
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900">
            {loading ? <Loader2 className="h-7 w-7 animate-spin text-slate-400" /> : questionsNew ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
