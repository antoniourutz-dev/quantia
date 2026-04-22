import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Hash, Loader2, Tag, ChevronRight, History, Sparkles } from 'lucide-react';
import type { DashboardBundle } from '../lib/quantiaApi';
import { getCurriculumCategoryGroupLabel, getCurriculumQuestionNumberBounds, getLastVisitedStudyQuestion } from '../lib/quantiaApi';
import { formatSyllabusLabel, type SyllabusType } from '../types';
import { useAppLocale } from '../lib/locale';

type StudyScope = 'all' | SyllabusType;
export type StudyModeType = 'topic' | 'range';

export interface StudyStartParams {
  mode: StudyModeType;
  scope: StudyScope;
  topic: string;
  count: number;
  range?: [number, number];
  resumeId?: string;
}

interface StudyExplorerProps {
  curriculum: string;
  bundle: DashboardBundle | null;
  onStartStudy: (params: StudyStartParams) => Promise<void>;
  onOpenQuestionBank: () => void;
}

export default function StudyExplorer({ curriculum, bundle, onStartStudy, onOpenQuestionBank }: StudyExplorerProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const MAX_RANGE_QUESTIONS = 200;
  
  const [studyMode, setStudyMode] = useState<StudyModeType>('topic');
  
  const [scope, setScope] = useState<StudyScope>('all');
  const [topic, setTopic] = useState<string>('');
  const [count, setCount] = useState<number>(20);
  const countOptions = [10, 20, 50];
  
  const [rangeFrom, setRangeFrom] = useState<string>('');
  const [rangeTo, setRangeTo] = useState<string>('');
  const [rangeBounds, setRangeBounds] = useState<{ min: number; max: number } | null>(null);
  const [rangeBoundsLoading, setRangeBoundsLoading] = useState(false);
  const [rangeTouched, setRangeTouched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastVisitedId, setLastVisitedId] = useState<string | null>(null);

  useEffect(() => {
    setLastVisitedId(getLastVisitedStudyQuestion());
  }, []);

  useEffect(() => {
    setRangeBounds(null);
    setRangeBoundsLoading(false);
    setRangeTouched(false);
    setRangeFrom('');
    setRangeTo('');
  }, [curriculum]);

  const ensureRangeBounds = async () => {
    if (rangeBoundsLoading || rangeBounds) return;
    setRangeBoundsLoading(true);
    try {
      const bounds = await getCurriculumQuestionNumberBounds(curriculum);
      setRangeBounds(bounds);
      if (bounds && !rangeTouched) {
        const defaultFrom = bounds.min;
        const defaultTo = Math.min(bounds.max, bounds.min + 19);
        setRangeFrom(String(defaultFrom));
        setRangeTo(String(defaultTo));
      }
    } catch {
      setRangeBounds(null);
    } finally {
      setRangeBoundsLoading(false);
    }
  };

  useEffect(() => {
    if (studyMode !== 'range') return;
    void ensureRangeBounds();
  }, [studyMode]);

  const availableTopics = useMemo(() => {
    const topics = (bundle?.practiceState.learningDashboardV2?.topicBreakdown ?? [])
      .filter((item) => {
        if (!item.topicLabel) return false;
        if (scope === 'all') return true;
        return item.scope === scope;
      })
      .map((item) => getCurriculumCategoryGroupLabel(curriculum, item.topicLabel)?.trim() ?? item.topicLabel.trim())
      .filter(Boolean);
    const deduped = [...new Set(topics)];
    deduped.sort((a, b) => a.localeCompare(b, locale === 'eu' ? 'eu' : 'es'));
    return deduped;
  }, [bundle, curriculum, locale, scope]);

  useEffect(() => {
    setTopic('');
  }, [scope]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      if (studyMode === 'range') {
        const fromValue = Math.trunc(Number(rangeFrom));
        const toValue = Math.trunc(Number(rangeTo));
        if (!Number.isFinite(fromValue) || !Number.isFinite(toValue)) {
          setError(isBasque ? 'Sartu balio egokiak.' : 'Introduce valores válidos.');
          setLoading(false);
          return;
        }
        if (fromValue <= 0 || toValue <= 0) {
          setError(isBasque ? 'Tarteak 1etik aurrera izan behar du.' : 'El rango debe empezar en 1 o más.');
          setLoading(false);
          return;
        }
        const minBound = rangeBounds?.min ?? 1;
        const maxBound = rangeBounds?.max ?? Math.max(fromValue, toValue);
        const clippedFrom = Math.max(minBound, Math.min(fromValue, maxBound));
        const clippedTo = Math.max(minBound, Math.min(toValue, maxBound));
        if (clippedFrom > clippedTo) {
          setError(isBasque ? 'Tartea ez da zuzena.' : 'El rango no es válido.');
          setLoading(false);
          return;
        }
        const computedCount = clippedTo - clippedFrom + 1;
        if (computedCount > MAX_RANGE_QUESTIONS) {
          setError(
            isBasque
              ? `Tarte handiegia da (gehienez ${MAX_RANGE_QUESTIONS} galdera).`
              : `Rango demasiado grande (máx. ${MAX_RANGE_QUESTIONS} preguntas).`,
          );
          setLoading(false);
          return;
        }
        await onStartStudy({
          mode: 'range',
          scope: 'all',
          topic: '',
          count: computedCount,
          range: [clippedFrom, clippedTo],
        });
      } else {
        await onStartStudy({ mode: 'topic', scope, topic, count });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isBasque ? 'Ezin izan da ikasketa hasi.' : 'No se ha podido iniciar el estudio.');
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!lastVisitedId) return;
    setLoading(true);
    setError(null);
    try {
      // Starting study from a specific ID - we'll treat it as a special case in handleStartStudy 
      // where it fetches that question + some context.
      // For now, simpler: start study for all but pass the ID to start at.
      await onStartStudy({ mode: 'topic', scope: 'all', topic: '', count: 20, resumeId: lastVisitedId });
    } catch (err) {
      setError(isBasque ? 'Ezin izan da estudioa berreskuratu.' : 'No se ha podido retomar el estudio.');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 lg:space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between gap-4">
        <div className="hidden lg:block">
          <div className="flex items-center gap-3 text-slate-400">
            <BookOpen size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{isBasque ? 'Ikasketa' : 'Modo Estudio Profesional'}</span>
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            {isBasque ? 'Ikasi test baten moduan' : 'Territorios de Estudio'}
          </h2>
          <p className="mt-2 text-slate-500 text-lg font-medium max-w-2xl">
            {isBasque
              ? 'Aukeratu temarioa eta gaia. Joan galderaz galdera, erantzun zuzena eta azalpena ikusiz.'
              : 'Asimila el temario de forma activa. Una pregunta a la vez, con subrayados y anotaciones persistentes.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenQuestionBank}
          className="inline-flex items-center justify-center gap-3 rounded-[2rem] border border-slate-200 bg-white px-5 py-4 text-slate-700 font-black text-base shadow-sm hover:bg-slate-50 transition-all"
        >
          <BookOpen size={18} className="text-indigo-600" />
          <span className="hidden sm:inline">{isBasque ? 'Galdera-bankua' : 'Banco de preguntas'}</span>
          <span className="sm:hidden">{isBasque ? 'Bankua' : 'Banco'}</span>
        </button>
      </div>

      {lastVisitedId && (
        <div className="bg-indigo-900 rounded-[2rem] p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-900/20 animate-in zoom-in-95 duration-500">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                 <History className="text-indigo-200" size={28} />
              </div>
              <div>
                 <h4 className="font-black text-xl tracking-tight">{isBasque ? 'Ikasten jarraitu' : 'Continuar territorio de estudio'}</h4>
                 <p className="text-indigo-200/80 font-medium text-sm mt-1">
                    {isBasque ? 'Utzi zenuen lekutik berrekin.' : 'Retoma exactamente donde lo dejaste en tu última sesión.'}
                 </p>
              </div>
           </div>
           <button 
             onClick={handleResume}
             disabled={loading}
             className="w-full md:w-auto bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50"
           >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} className="text-indigo-600" />}
              {isBasque ? 'Jarraitu orain' : 'Continuar ahora'}
           </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-8 relative overflow-hidden">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <BookOpen size={18} className="text-indigo-600" />
              <span className="font-black tracking-tight text-lg">{isBasque ? 'Konfigurazioa' : 'Configurar sesión de estudio'}</span>
            </div>
          </div>

          <div className="flex border border-slate-200 p-1 rounded-2xl bg-slate-50 relative">
            <button
               onClick={() => setStudyMode('topic')}
               className={`flex-1 ${studyMode === 'topic' ? 'bg-white shadow-sm border-slate-100 font-black text-indigo-700' : 'text-slate-500 font-semibold hover:text-slate-700'} py-3 px-4 rounded-xl text-sm transition-all`}
            >
              {isBasque ? 'Gaika' : 'Por Bloque / Tema'}
            </button>
            <button
               onClick={() => setStudyMode('range')}
               className={`flex-1 ${studyMode === 'range' ? 'bg-white shadow-sm border-slate-100 font-black text-indigo-700' : 'text-slate-500 font-semibold hover:text-slate-700'} py-3 px-4 rounded-xl text-sm transition-all`}
            >
              {isBasque ? 'Tartea' : 'Por Rango'}
            </button>
          </div>

          {studyMode === 'topic' ? (
             <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
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
                          : formatSyllabusLabel(value, locale, { curriculum, variant: 'compact' })}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Gaia' : 'Tema (Opcional)'}
                    </div>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                      {availableTopics.length}
                    </div>
                  </div>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                  >
                    <option value="">{isBasque ? 'Gai guztiak' : 'Todos los temas del territorio'}</option>
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
             </div>
          ) : (
             <div className="space-y-8 animate-in slide-in-from-left-4 fade-in duration-300">
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 mt-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-amber-100 rounded-lg p-1.5 mt-0.5">
                       <BookOpen className="text-amber-600" size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm mb-1">{isBasque ? 'Galderen tartea' : 'Estudio por números'}</h4>
                      <p className="text-xs text-amber-700/80 font-medium leading-relaxed">
                        {isBasque ? 'Aukeratu hasiera eta amaiera.' : 'Introduce el rango exacto de preguntas. Especialmente útil para repaso incremental.'}
                      </p>
                      {rangeBounds ? (
                        <div className="mt-2 text-[11px] font-black text-amber-900/70 tracking-wide">
                          {isBasque ? 'Eskuragarri:' : 'Disponibles:'} {rangeBounds.min}–{rangeBounds.max}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Hasiera' : 'Pregunta Inicio'}
                    </div>
                    <input 
                      type="number"
                      value={rangeFrom}
                      onChange={(e) => {
                        setRangeTouched(true);
                        setRangeFrom(e.target.value);
                      }}
                      min={rangeBounds?.min ?? 1}
                      max={rangeBounds?.max ?? undefined}
                      className="w-full text-center rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-xl font-black text-slate-700 outline-none focus:border-indigo-400" 
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Amaiera' : 'Pregunta Fin'}
                    </div>
                    <input 
                      type="number"
                      value={rangeTo}
                      onChange={(e) => {
                        setRangeTouched(true);
                        setRangeTo(e.target.value);
                      }}
                      min={rangeBounds?.min ?? 1}
                      max={rangeBounds?.max ?? undefined}
                      className="w-full text-center rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-xl font-black text-slate-700 outline-none focus:border-indigo-400" 
                    />
                  </div>
                </div>

                {rangeBoundsLoading ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    {isBasque ? 'Tartea kargatzen…' : 'Cargando rango…'}
                  </div>
                ) : null}
             </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-bold">
              {error}
            </div>
          ) : null}

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full flex items-center justify-between gap-3 rounded-[2rem] bg-indigo-600 pl-8 pr-6 py-5 text-white shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all hover:shadow-[0_10px_30px_rgba(79,70,229,0.4)] hover:-translate-y-1 disabled:bg-slate-300 disabled:shadow-none"
          >
            <span className="font-black text-lg">{isBasque ? 'Ikasketa hasi' : 'Construir estudio'}</span>
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
               {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight size={20} className="" />}
            </div>
          </button>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-3 text-slate-700 mb-8">
            <BookOpen size={18} className="text-indigo-600" />
            <div className="font-black text-lg tracking-tight">{isBasque ? 'Nola funtzionatzen duen' : 'Filosofía del Modo Estudio'}</div>
          </div>
          
          <div className="space-y-6">
            <div className="flex gap-4">
               <div className="w-10 h-10 shrink-0 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">1</div>
               <div>
                 <h4 className="font-bold text-slate-800 text-[15px] mb-1">Sin presión de tiempo</h4>
                 <p className="text-sm font-medium text-slate-500 leading-relaxed">
                   Diseñado no para acertar rápido, sino para asimilar el conocimiento profundo leyendo pregunta, opciones y explicación.
                 </p>
               </div>
            </div>
            
            <div className="flex gap-4">
               <div className="w-10 h-10 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">2</div>
               <div>
                 <h4 className="font-bold text-slate-800 text-[15px] mb-1">Marcador semántico personal</h4>
                 <p className="text-sm font-medium text-slate-500 leading-relaxed">
                   Subraya leyes en azul, plazos en naranja, excepciones en rojo y conceptos clave en verde. Todo se queda guardado para el futuro.
                 </p>
               </div>
            </div>

            <div className="flex gap-4">
               <div className="w-10 h-10 shrink-0 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">3</div>
               <div>
                 <h4 className="font-bold text-slate-800 text-[15px] mb-1">Anotaciones propias (Novedad)</h4>
                 <p className="text-sm font-medium text-slate-500 leading-relaxed">
                   Añade reglas mnemotécnicas, dudas o reflexiones a cada pregunta en un espacio privado que viaja contigo.
                 </p>
               </div>
            </div>
            
            <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-6 py-5 flex items-center gap-4">
               <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">
                 <Tag size={18} />
               </div>
               <p className="text-[13px] font-bold text-indigo-900/80 leading-relaxed">
                 En modo Estudio no se penaliza ni se alteran tus métricas de Oposik. Es gimnasio puro.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
