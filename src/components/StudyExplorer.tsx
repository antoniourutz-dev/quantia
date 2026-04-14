import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Hash, Loader2, Tag } from 'lucide-react';
import type { DashboardBundle } from '../lib/quantiaApi';
import type { SyllabusType } from '../types';
import { useAppLocale } from '../lib/locale';

type StudyScope = 'all' | SyllabusType;

interface StudyExplorerProps {
  bundle: DashboardBundle | null;
  onStartStudy: (params: { scope: StudyScope; topic: string; count: number }) => Promise<void>;
}

export default function StudyExplorer({ bundle, onStartStudy }: StudyExplorerProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [scope, setScope] = useState<StudyScope>('all');
  const [topic, setTopic] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number>(20);
  const countOptions = [10, 20, 50];

  const availableTopics = useMemo(() => {
    const topics = (bundle?.practiceState.learningDashboardV2?.topicBreakdown ?? [])
      .filter((item) => {
        if (!item.topicLabel) return false;
        if (scope === 'all') return true;
        return item.scope === scope;
      })
      .map((item) => item.topicLabel.trim())
      .filter(Boolean);
    const deduped = [...new Set(topics)];
    deduped.sort((a, b) => a.localeCompare(b, locale === 'eu' ? 'eu' : 'es'));
    return deduped;
  }, [bundle, locale, scope]);

  useEffect(() => {
    setTopic('');
  }, [scope]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await onStartStudy({ scope, topic, count });
    } catch (err) {
      setError(err instanceof Error ? err.message : isBasque ? 'Ezin izan da ikasketa hasi.' : 'No se ha podido iniciar el estudio.');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-slate-400">
            <BookOpen size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{isBasque ? 'Ikasketa' : 'Estudio'}</span>
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            {isBasque ? 'Ikasi test baten moduan' : 'Estudia como un test'}
          </h2>
          <p className="mt-2 text-slate-500 text-lg font-medium">
            {isBasque
              ? 'Aukeratu temarioa eta gaia. Joan galderaz galdera, erantzun zuzena eta azalpena ikusiz.'
              : 'Elige temario y tema. Avanza pregunta a pregunta, viendo la respuesta correcta y la explicacion.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <BookOpen size={18} className="text-indigo-600" />
              <span className="font-black">{isBasque ? 'Konfigurazioa' : 'Configuracion'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {isBasque ? 'Temarioa' : 'Temario'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['all', 'common', 'specific'] as StudyScope[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setScope(value)}
                  className={`py-3 rounded-2xl border-2 font-black text-xs transition-all ${
                    scope === value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-100'
                  }`}
                >
                  {value === 'all'
                    ? isBasque ? 'Denak' : 'Todos'
                    : value === 'common'
                      ? isBasque ? 'Orokorra' : 'Comun'
                      : isBasque ? 'Espez.' : 'Espec.'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Gaia' : 'Tema'}
              </div>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                {availableTopics.length}
              </div>
            </div>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
            >
              <option value="">{isBasque ? 'Gai guztiak' : 'Todos los temas'}</option>
              {availableTopics.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Hash size={18} className="text-indigo-600" />
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Kopurua' : 'Cantidad'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {countOptions.map((value) => (
                <button
                  key={value}
                  onClick={() => setCount(value)}
                  className={`py-4 rounded-2xl border-2 font-black text-lg transition-all ${
                    count === value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 bg-white text-slate-400 hover:border-indigo-100'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-bold">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Tag size={16} className="text-indigo-600" />
              <span className="text-xs font-black uppercase tracking-widest">{isBasque ? 'Oharra' : 'Nota'}</span>
            </div>
            <div className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
              {isBasque
                ? 'Ikasketa moduan saioa ez da estatistiketan sinkronizatzen. Irakurketa aktiboa da, ez ebaluazioa.'
                : 'En modo Estudio no se sincroniza la sesion en estadisticas. Es lectura activa, no evaluacion.'}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-[2rem] bg-indigo-600 px-6 py-5 text-white font-black text-xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-1 disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <BookOpen size={20} />}
            {isBasque ? 'Ikasketa hasi' : 'Iniciar estudio'}
          </button>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-3 text-slate-700">
            <BookOpen size={18} className="text-indigo-600" />
            <div className="font-black">{isBasque ? 'Nola funtzionatzen duen' : 'Como funciona'}</div>
          </div>
          <div className="mt-6 space-y-4 text-slate-600 font-medium leading-relaxed">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5">
              {isBasque
                ? 'Galderaz galdera nabigatzen duzu, test batean bezala, baina ikasteko asmoz.'
                : 'Navegas pregunta a pregunta como en un test, pero con intencion de aprendizaje.'}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5">
              {isBasque
                ? 'Erantzutean zuzena markatzen da eta azalpena zabaldu dezakezu.'
                : 'Al responder se marca la correcta y puedes desplegar la explicacion.'}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5">
              {isBasque
                ? 'Iragazi temarioz eta gaiz ezagutza bloke jakin batean kontzentratzeko.'
                : 'Filtra por temario y tema para concentrarte en un bloque concreto de conocimiento.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
