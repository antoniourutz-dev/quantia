import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, Hash, Zap, AlertCircle, Timer, SlidersHorizontal } from 'lucide-react';
import { SyllabusType, formatSyllabusLabel, PracticeMode } from '../types';
import { isLawSelectionCurriculum, isSingleScopeCurriculum, useAppLocale } from '../lib/locale';

interface TestSelectionProps {
  curriculum: string;
  lawOptions: string[];
  lawOptionsLoading?: boolean;
  initialLaw?: string | null;
  onStart: (mode: PracticeMode, syllabus?: SyllabusType, count?: number) => void;
  onStartLawTest: (law: string, count?: number) => void;
  onStartCustom: (params: { from: number; to: number; randomize: boolean }) => void;
  onLoadCustomBounds: () => Promise<{ min: number; max: number } | null>;
  initialSyllabus: SyllabusType | null;
}

type SelectionMode = 'standard' | 'quick' | 'errors' | 'simulacro' | 'custom';

export default function TestSelection({
  curriculum,
  lawOptions,
  lawOptionsLoading = false,
  initialLaw = null,
  onStart,
  onStartLawTest,
  onStartCustom,
  onLoadCustomBounds,
  initialSyllabus,
}: TestSelectionProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('standard');
  const [selectedSyllabus, setSelectedSyllabus] = useState<SyllabusType>(initialSyllabus || 'common');
  const [selectedLaw, setSelectedLaw] = useState<string>(initialLaw ?? '');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const options = [10, 20, 50];
  const simulacroOptions = [50, 100];
  const [simulacroScope, setSimulacroScope] = useState<'mixed' | SyllabusType>('mixed');
  const [simulacroCount, setSimulacroCount] = useState<number>(50);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [customOrder, setCustomOrder] = useState<'sequence' | 'random'>('sequence');
  const [customBounds, setCustomBounds] = useState<{ min: number; max: number } | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const usesLawSelection = useMemo(() => isLawSelectionCurriculum(curriculum), [curriculum]);
  const usesSingleScope = useMemo(() => isSingleScopeCurriculum(curriculum), [curriculum]);
  const configRef = useRef<HTMLDivElement | null>(null);
  const modeNeedsConfig = selectionMode === 'standard' || selectionMode === 'simulacro' || selectionMode === 'custom';
  const startLabel =
    selectionMode === 'standard'
      ? isBasque
        ? usesLawSelection
          ? 'Lege bidezko testa sortu'
          : usesSingleScope
            ? 'Testa sortu'
            : 'Test blokea sortu'
        : usesLawSelection
          ? 'Empezar por esta ley'
          : usesSingleScope
            ? 'Empezar este test'
            : 'Empezar este bloque'
      : selectionMode === 'quick'
        ? isBasque
          ? 'Bloke laburra egin'
          : 'Hacer bloque corto'
        : selectionMode === 'errors'
          ? isBasque
            ? 'Nire hutsetara joan'
            : 'Ir a mis fallos'
          : selectionMode === 'custom'
            ? isBasque
              ? 'Tarte hau hasi'
              : 'Empezar este tramo'
            : isBasque
              ? 'Simulakroa hasi'
              : 'Iniciar simulacro';
  const formatSyllabusUiLabel = (syllabus: SyllabusType) => {
    if (isBasque) {
      return syllabus === 'common' ? 'Gai-zerrenda arrunta' : 'Gai-zerrenda espezifikoa';
    }
    return `Temario ${formatSyllabusLabel(syllabus, locale)}`;
  };

  useEffect(() => {
    if (!usesLawSelection) return;

    if (initialLaw && lawOptions.includes(initialLaw)) {
      setSelectedLaw(initialLaw);
      return;
    }

    if (!selectedLaw || !lawOptions.includes(selectedLaw)) {
      setSelectedLaw(lawOptions[0] ?? '');
    }
  }, [initialLaw, lawOptions, selectedLaw, usesLawSelection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      if (selectionMode === 'quick' || selectionMode === 'errors') return;
      const handle = window.setTimeout(() => {
        configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return () => window.clearTimeout(handle);
    }
  }, [selectionMode]);

  const ensureCustomBounds = async () => {
    if (customLoading || customBounds) return;
    setCustomLoading(true);
    setCustomError(null);
    try {
      const bounds = await onLoadCustomBounds();
      setCustomBounds(bounds);
      if (bounds) {
        setCustomFrom(String(bounds.min));
        setCustomTo(String(bounds.max));
      }
    } catch (error) {
      setCustomError(error instanceof Error ? error.message : (isBasque ? 'Ezin izan da kargatu.' : 'No se ha podido cargar.'));
    } finally {
      setCustomLoading(false);
    }
  };

  const handleStartCustom = () => {
    setCustomError(null);
    const fromValue = Number(customFrom);
    const toValue = Number(customTo);
    if (!Number.isFinite(fromValue) || !Number.isFinite(toValue)) {
      setCustomError(isBasque ? 'Sartu balio egokiak.' : 'Introduce valores válidos.');
      return;
    }
    if (fromValue <= 0 || toValue <= 0) {
      setCustomError(isBasque ? 'Tarteak 1etik aurrera izan behar du.' : 'El rango debe empezar en 1 o más.');
      return;
    }
    const minBound = customBounds?.min ?? 1;
    const maxBound = customBounds?.max ?? Math.max(fromValue, toValue);
    const clippedFrom = Math.max(minBound, Math.min(fromValue, maxBound));
    const clippedTo = Math.max(minBound, Math.min(toValue, maxBound));
    if (clippedFrom > clippedTo) {
      setCustomError(isBasque ? 'Tartea ez da zuzena.' : 'El rango no es válido.');
      return;
    }
    onStartCustom({ from: clippedFrom, to: clippedTo, randomize: customOrder === 'random' });
  };

  const handleStart = () => {
    if (selectionMode === 'standard') {
      if (usesLawSelection) {
        onStartLawTest(selectedLaw, questionCount);
        return;
      }
      onStart('standard', usesSingleScope ? undefined : selectedSyllabus, questionCount);
    } else if (selectionMode === 'quick') {
      onStart('quick_five', undefined, 5);
    } else if (selectionMode === 'errors') {
      onStart('review', usesSingleScope ? undefined : 'specific', 10);
    } else if (selectionMode === 'simulacro') {
      onStart(
        'simulacro',
        usesSingleScope ? undefined : simulacroScope === 'mixed' ? undefined : simulacroScope,
        simulacroCount,
      );
    } else if (selectionMode === 'custom') {
      handleStartCustom();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
          <Zap className="text-indigo-600 w-5 h-5" />
          {isBasque ? 'Nola praktikatu nahi duzu gaur?' : 'Como quieres practicar hoy'}
        </h2>

        <div className="grid grid-cols-3 md:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-6">
          <button
            onClick={() => setSelectionMode('standard')}
            className={`p-5 sm:p-7 lg:p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-3 sm:gap-4 text-center ${
              selectionMode === 'standard'
                ? 'border-indigo-600 bg-indigo-50 shadow-xl shadow-indigo-100 ring-4 ring-indigo-500/10'
                : 'border-slate-50 bg-white hover:border-indigo-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 rounded-2xl ${selectionMode === 'standard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <BookOpen size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl text-slate-800 leading-tight">
                {usesLawSelection
                  ? isBasque
                    ? 'Lege bidezko testa'
                    : 'Test por ley'
                  : usesSingleScope
                    ? isBasque
                      ? 'Testa'
                      : 'Test'
                  : isBasque
                    ? 'Temario bidezko testa'
                    : 'Test por temario'}
              </p>
              <p className="hidden sm:block text-sm font-medium text-slate-500 mt-2">
                {usesLawSelection
                  ? isBasque
                      ? 'Aukeratu errepasatu nahi duzun legea'
                    : 'Elige la ley que quieres repasar'
                  : usesSingleScope
                    ? isBasque
                      ? 'Galdera kopurua baino ez duzu aukeratu behar'
                      : 'Tu solo eliges cuantas preguntas'
                  : isBasque
                    ? 'Blokea aukeratu eta lanean hasi'
                    : 'Elige por bloque y ponte a ello'}
              </p>
            </div>
          </button>

          <button
            onClick={() => setSelectionMode('quick')}
            className={`p-5 sm:p-7 lg:p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-3 sm:gap-4 text-center ${
              selectionMode === 'quick'
                ? 'border-amber-500 bg-amber-50 shadow-xl shadow-amber-100 ring-4 ring-amber-500/10'
                : 'border-slate-50 bg-white hover:border-amber-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 rounded-2xl ${selectionMode === 'quick' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Zap size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl text-slate-800 leading-tight">{isBasque ? 'Bloke laburra' : 'Bloque corto'}</p>
              <p className="hidden sm:block text-sm font-medium text-slate-500 mt-2">
                {isBasque ? 'Berriz sartzeko 5 galdera' : '5 preguntas para volver a entrar'}
              </p>
            </div>
          </button>

          <button
            onClick={() => setSelectionMode('errors')}
            className={`p-5 sm:p-7 lg:p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-3 sm:gap-4 text-center ${
              selectionMode === 'errors'
                ? 'border-rose-500 bg-rose-50 shadow-xl shadow-rose-100 ring-4 ring-rose-500/10'
                : 'border-slate-50 bg-white hover:border-rose-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 rounded-2xl ${selectionMode === 'errors' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <AlertCircle size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl text-slate-800 leading-tight">{isBasque ? 'Hutsegiteak zuzendu' : 'Corregir fallos'}</p>
              <p className="hidden sm:block text-sm font-medium text-slate-500 mt-2">
                {isBasque ? 'Zoaz gehien kostatzen zaizunera' : 'Ve justo a lo que mas se te resiste'}
              </p>
            </div>
          </button>

          <button
            onClick={() => setSelectionMode('simulacro')}
            className={`p-5 sm:p-7 lg:p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-3 sm:gap-4 text-center ${
              selectionMode === 'simulacro'
                ? 'border-slate-700 bg-slate-50 shadow-xl shadow-slate-200 ring-4 ring-slate-900/10'
                : 'border-slate-50 bg-white hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div
              className={`p-3 sm:p-4 rounded-2xl ${
                selectionMode === 'simulacro' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Timer size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl text-slate-800 leading-tight">{isBasque ? 'Simulakroa' : 'Simulacro'}</p>
              <p className="hidden sm:block text-sm font-medium text-slate-500 mt-2">
                {isBasque ? 'Erantzunak amaieran ikusiko dituzu' : 'Sin ver las respuestas hasta el final'}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setSelectionMode('custom');
              void ensureCustomBounds();
            }}
            className={`p-5 sm:p-7 lg:p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-3 sm:gap-4 text-center ${
              selectionMode === 'custom'
                ? 'border-violet-600 bg-violet-50 shadow-xl shadow-violet-100 ring-4 ring-violet-500/10'
                : 'border-slate-50 bg-white hover:border-violet-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 rounded-2xl ${selectionMode === 'custom' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <SlidersHorizontal size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl text-slate-800 leading-tight">
                {isBasque ? 'Zure neurrira' : 'A tu medida'}
              </p>
              <p className="hidden sm:block text-sm font-medium text-slate-500 mt-2">
                {isBasque ? 'Landu nahi duzun tartea aukeratu' : 'Escoge el tramo que quieres trabajar'}
              </p>
            </div>
          </button>
        </div>
      </div>

      <div ref={configRef} className="scroll-mt-[calc(7rem+env(safe-area-inset-top))]" />

      {modeNeedsConfig ? (
        <div className="lg:hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          {selectionMode === 'standard' ? (
            <div className="space-y-6">
              {!usesSingleScope ? (
                usesLawSelection ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Legea' : 'Ley'}
                    </div>
                    <select
                      value={selectedLaw}
                      onChange={(e) => setSelectedLaw(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                    >
                      {lawOptions.map((law) => (
                        <option key={law} value={law}>
                          {law}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Temarioa' : 'Temario'}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSyllabus('common')}
                        className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                          selectedSyllabus === 'common'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-slate-100 bg-white text-slate-600'
                        }`}
                      >
                        {formatSyllabusUiLabel('common')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSyllabus('specific')}
                        className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                          selectedSyllabus === 'specific'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                            : 'border-slate-100 bg-white text-slate-600'
                        }`}
                      >
                        {formatSyllabusUiLabel('specific')}
                      </button>
                    </div>
                  </div>
                )
              ) : null}

              <div className="space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {isBasque ? 'Galdera kopurua' : 'Cantidad'}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {options.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`rounded-2xl border-2 px-4 py-4 font-black text-lg transition-all ${
                        questionCount === count
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-100 bg-white text-slate-500'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {selectionMode === 'simulacro' ? (
            <div className="space-y-6">
              {!usesSingleScope ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {isBasque ? 'Zatia' : 'Parte'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'mixed', label: isBasque ? 'Mistoa' : 'Mixto' },
                      { id: 'common', label: formatSyllabusUiLabel('common') },
                      { id: 'specific', label: formatSyllabusUiLabel('specific') },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSimulacroScope(opt.id)}
                        className={`rounded-2xl border-2 px-3 py-4 font-black text-xs transition-all ${
                          simulacroScope === opt.id
                            ? 'border-slate-800 bg-slate-50 text-slate-900'
                            : 'border-slate-100 bg-white text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {isBasque ? 'Galderak' : 'Preguntas'}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {simulacroOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSimulacroCount(count)}
                      className={`rounded-2xl border-2 px-4 py-4 font-black text-lg transition-all ${
                        simulacroCount === count
                          ? 'border-slate-800 bg-slate-50 text-slate-900'
                          : 'border-slate-100 bg-white text-slate-500'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {selectionMode === 'custom' ? (
            <div className="space-y-6">
              {customError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                  {customError}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {isBasque ? 'Hasiera' : 'Desde'}
                  </div>
                  <input
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-violet-300 focus:bg-white"
                    placeholder={customBounds ? String(customBounds.min) : '1'}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {isBasque ? 'Amaiera' : 'Hasta'}
                  </div>
                  <input
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-violet-300 focus:bg-white"
                    placeholder={customBounds ? String(customBounds.max) : '100'}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {isBasque ? 'Ordena' : 'Orden'}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomOrder('sequence')}
                    className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                      customOrder === 'sequence'
                        ? 'border-violet-600 bg-violet-50 text-violet-800'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {isBasque ? 'Sekuentziala' : 'Secuencial'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomOrder('random')}
                    className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                      customOrder === 'random'
                        ? 'border-violet-600 bg-violet-50 text-violet-800'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {isBasque ? 'Ausazkoa' : 'Aleatorio'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectionMode === 'standard' && !usesSingleScope ? (
        <div className="hidden lg:block">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
            <BookOpen className="text-indigo-600 w-5 h-5" />
            {usesLawSelection
              ? isBasque
                ? 'Hautatu legea'
                : 'Elige la ley'
              : isBasque
                ? 'Landu nahi duzun zatia aukeratu'
                : 'Elige la parte que quieres trabajar'}
          </h2>

          {usesLawSelection ? (
            <div className="space-y-4">
              {lawOptions.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Legea' : 'Ley'}
                    </div>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                      {lawOptions.length}
                    </div>
                  </div>
                  <select
                    value={selectedLaw}
                    onChange={(e) => setSelectedLaw(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                  >
                    {lawOptions.map((law) => (
                      <option key={law} value={law}>
                        {law}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500">
                  {lawOptionsLoading
                    ? isBasque
                      ? 'Legeen zerrenda kargatzen...'
                      : 'Cargando lista de leyes...'
                    : isBasque
                      ? 'Oraindik ez da legerik aurkitu oposizio honetarako.'
                      : 'Aun no aparecen leyes para esta oposicion.'}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => setSelectedSyllabus('common')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                  selectedSyllabus === 'common'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-50 bg-white hover:border-indigo-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedSyllabus === 'common' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg text-slate-800">
                  {formatSyllabusUiLabel('common')}
                </span>
              </button>

              <button
                onClick={() => setSelectedSyllabus('specific')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                  selectedSyllabus === 'specific'
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-50 bg-white hover:border-emerald-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedSyllabus === 'specific' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg text-slate-800">
                  {formatSyllabusUiLabel('specific')}
                </span>
              </button>
            </div>
          )}
        </div>
        </div>
      ) : null}

      {selectionMode === 'standard' ? (
        <div className="hidden lg:block">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
            <Hash className="text-indigo-600 w-5 h-5" />
            {isBasque ? 'Zenbat galdera egin nahi dituzu?' : 'Cuantas preguntas quieres hacer'}
          </h2>

          <div className="grid grid-cols-3 gap-6">
            {options.map((count) => (
              <button
                key={count}
                onClick={() => setQuestionCount(count)}
                className={`py-6 px-8 rounded-2xl border-2 transition-all duration-300 font-black text-2xl ${
                  questionCount === count
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-50 bg-white text-slate-400 hover:border-indigo-100'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        </div>
      ) : null}

      {selectionMode === 'simulacro' ? (
        <div className="hidden lg:block">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500 space-y-8">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Timer className="text-slate-700 w-5 h-5" />
            {isBasque ? 'Prestatu simulakroa' : 'Prepara el simulacro'}
          </h2>

          {!usesSingleScope ? (
            <div className="space-y-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Azterketaren zatia' : 'Parte del examen'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={() => setSimulacroScope('mixed')}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                    simulacroScope === 'mixed'
                      ? 'border-slate-800 bg-slate-50'
                      : 'border-slate-50 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${simulacroScope === 'mixed' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="font-bold text-lg text-slate-800">{isBasque ? 'Mistoa' : 'Mixto'}</span>
                </button>

                <button
                  onClick={() => setSimulacroScope('common')}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                    simulacroScope === 'common'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-50 bg-white hover:border-indigo-100'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${simulacroScope === 'common' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="font-bold text-lg text-slate-800">
                    {formatSyllabusUiLabel('common')}
                  </span>
                </button>

                <button
                  onClick={() => setSimulacroScope('specific')}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                    simulacroScope === 'specific'
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-50 bg-white hover:border-emerald-100'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${simulacroScope === 'specific' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="font-bold text-lg text-slate-800">
                    {formatSyllabusUiLabel('specific')}
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {isBasque ? 'Galdera kopurua' : 'Cantidad de preguntas'}
            </div>
            <div className="grid grid-cols-2 gap-6">
              {simulacroOptions.map((count) => (
                <button
                  key={count}
                  onClick={() => setSimulacroCount(count)}
                  className={`py-6 px-8 rounded-2xl border-2 transition-all duration-300 font-black text-2xl ${
                    simulacroCount === count
                      ? 'border-slate-800 bg-slate-50 text-slate-900'
                      : 'border-slate-50 bg-white text-slate-400 hover:border-slate-200'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isBasque
                ? 'Simulakroan ez duzu erantzun zuzena ikusiko amaierara arte.'
                : 'En simulacro veras todo el feedback al terminar.'}
            </div>
          </div>
        </div>
        </div>
      ) : null}

      {selectionMode === 'custom' ? (
        <div className="hidden lg:block">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <SlidersHorizontal className="text-violet-600 w-5 h-5" />
              {isBasque ? 'Landu nahi duzun tartea' : 'Elige el tramo'}
            </h2>
            {customBounds ? (
              <div className="text-xs font-black text-slate-500">
                {isBasque ? 'Tartea' : 'Rango'}: {customBounds.min}–{customBounds.max}
              </div>
            ) : null}
          </div>

          {customError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
              {customError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Hasiera' : 'Desde'}
              </div>
              <input
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-200/40"
                placeholder={customBounds ? String(customBounds.min) : '1'}
              />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Amaiera' : 'Hasta'}
              </div>
              <input
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-200/40"
                placeholder={customBounds ? String(customBounds.max) : '100'}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {isBasque ? 'Nola atera nahi dituzu?' : 'Como quieres que salgan'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => setCustomOrder('sequence')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between ${
                  customOrder === 'sequence'
                    ? 'border-violet-600 bg-violet-50'
                    : 'border-slate-50 bg-white hover:border-violet-100'
                }`}
              >
                <span className="font-black text-slate-800">{isBasque ? 'Sekuentziala' : 'Secuencial'}</span>
                <div className={`w-3 h-3 rounded-full ${customOrder === 'sequence' ? 'bg-violet-600' : 'bg-slate-200'}`} />
              </button>
              <button
                type="button"
                onClick={() => setCustomOrder('random')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between ${
                  customOrder === 'random'
                    ? 'border-violet-600 bg-violet-50'
                    : 'border-slate-50 bg-white hover:border-violet-100'
                }`}
              >
                <span className="font-black text-slate-800">{isBasque ? 'Ausazkoa' : 'Aleatorio'}</span>
                <div className={`w-3 h-3 rounded-full ${customOrder === 'random' ? 'bg-violet-600' : 'bg-slate-200'}`} />
              </button>
            </div>
            {customLoading ? (
              <div className="text-xs font-bold text-slate-500">
                {isBasque ? 'Kargatzen...' : 'Cargando...'}
              </div>
            ) : null}
          </div>
        </div>
        </div>
      ) : null}

      <div className="lg:static fixed left-0 right-0 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] z-50 px-4 sm:px-6">
        <button
          onClick={handleStart}
          disabled={selectionMode === 'standard' && usesLawSelection && (!selectedLaw || lawOptions.length === 0)}
          className={`w-full py-5 sm:py-6 rounded-[2rem] font-black text-lg sm:text-2xl shadow-2xl transition-all duration-500 flex items-center justify-center gap-4 ${
            selectionMode === 'standard'
              ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
              : selectionMode === 'quick'
                ? 'bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600'
                : selectionMode === 'errors'
                  ? 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700'
                  : selectionMode === 'custom'
                    ? 'bg-violet-600 text-white shadow-violet-200 hover:bg-violet-700'
                    : 'bg-slate-800 text-white shadow-slate-200 hover:bg-slate-900'
          } disabled:bg-slate-300 disabled:text-white disabled:shadow-none`}
        >
          {startLabel}
          <ChevronRight size={28} />
        </button>
      </div>
      <div className="h-[220px] lg:hidden" />
    </div>
  );
}
