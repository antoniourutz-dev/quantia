import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, Hash, Zap, AlertCircle, Timer, SlidersHorizontal } from 'lucide-react';
import { SyllabusType, formatSyllabusLabel, PracticeMode } from '../types';
import { isLawSelectionCurriculum, isSingleScopeCurriculum, useAppLocale } from '../lib/locale';
import type { CustomPracticeConfig, CustomPracticeContentScope } from '../domain/customPractice/customPracticeTypes';
import { getCurriculumTopicOptions } from '../lib/quantiaApi';

type SelectionMode = 'standard' | 'quick' | 'errors' | 'simulacro' | 'custom';

export type TestSelectionStateSnapshot = {
  selectionMode: SelectionMode;
  selectedSyllabus: SyllabusType;
  selectedLaw: string;
  questionCount: number;
  simulacroScope: 'mixed' | SyllabusType;
  simulacroCount: number;
  customFrom: string;
  customTo: string;
  customOrder: 'sequence' | 'random';
  customContentScope: CustomPracticeContentScope;
  customTopicMode: 'all' | 'single';
  customTopic: string;
  customSessionLength: number;
  customShowMarks: boolean;
  customShowNotes: boolean;
};

interface TestSelectionProps {
  curriculum: string;
  lawOptions: string[];
  lawOptionsLoading?: boolean;
  initialLaw?: string | null;
  onStart: (mode: PracticeMode, syllabus?: SyllabusType, count?: number) => void;
  onStartLawTest: (law: string, count?: number) => void;
  onStartCustomPractice: (config: CustomPracticeConfig) => void;
  initialSyllabus: SyllabusType | null;
  initialState?: TestSelectionStateSnapshot | null;
  onStateChange?: (state: TestSelectionStateSnapshot) => void;
}

export default function TestSelection({
  curriculum,
  lawOptions,
  lawOptionsLoading = false,
  initialLaw = null,
  onStart,
  onStartLawTest,
  onStartCustomPractice,
  initialSyllabus,
  initialState = null,
  onStateChange,
}: TestSelectionProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(initialState?.selectionMode ?? 'standard');
  const [selectedSyllabus, setSelectedSyllabus] = useState<SyllabusType>(
    initialState?.selectedSyllabus ?? initialSyllabus ?? 'common',
  );
  const [selectedLaw, setSelectedLaw] = useState<string>(initialState?.selectedLaw ?? initialLaw ?? '');
  const [questionCount, setQuestionCount] = useState<number>(initialState?.questionCount ?? 20);
  const options = [10, 20, 50];
  const simulacroOptions = [50, 100];
  const [simulacroScope, setSimulacroScope] = useState<'mixed' | SyllabusType>(initialState?.simulacroScope ?? 'mixed');
  const [simulacroCount, setSimulacroCount] = useState<number>(initialState?.simulacroCount ?? 50);
  const [customFrom] = useState<string>(initialState?.customFrom ?? '');
  const [customTo] = useState<string>(initialState?.customTo ?? '');
  const [customOrder] = useState<'sequence' | 'random'>(initialState?.customOrder ?? 'sequence');
  const [customError, setCustomError] = useState<string | null>(null);
  const [customContentScope, setCustomContentScope] = useState<CustomPracticeContentScope>(
    initialState?.customContentScope ?? 'all_opposition',
  );
  const [customTopicMode, setCustomTopicMode] = useState<'all' | 'single'>(initialState?.customTopicMode ?? 'all');
  const [customTopic, setCustomTopic] = useState(initialState?.customTopic ?? '');
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [customTopicsLoading, setCustomTopicsLoading] = useState(false);
  const [customSessionLength, setCustomSessionLength] = useState(initialState?.customSessionLength ?? 10);
  const [customShowMarks, setCustomShowMarks] = useState(initialState?.customShowMarks ?? false);
  const [customShowNotes, setCustomShowNotes] = useState(initialState?.customShowNotes ?? false);
  const usesLawSelection = useMemo(() => isLawSelectionCurriculum(curriculum), [curriculum]);
  const usesSingleScope = useMemo(() => isSingleScopeCurriculum(curriculum), [curriculum]);
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
          ? 'Test pertsonalizatua hasi'
          : 'Empezar test'
            : isBasque
              ? 'Simulakroa hasi'
              : 'Iniciar simulacro';
  const formatSyllabusUiLabel = (syllabus: SyllabusType) => {
    return formatSyllabusLabel(syllabus, locale, {
      curriculum,
      variant: 'section',
    });
  };
  const formatCustomContentScopeLabel = (scope: CustomPracticeContentScope) => {
    if (scope === 'all_opposition') {
      return isBasque ? 'Oposizio osoa' : 'Toda la oposición';
    }
    if (scope === 'common_only') {
      return formatSyllabusLabel('common', locale, { curriculum });
    }
    if (scope === 'specific_only') {
      return formatSyllabusLabel('specific', locale, { curriculum });
    }
    return `${formatSyllabusLabel('common', locale, { curriculum })} + ${formatSyllabusLabel('specific', locale, { curriculum })}`;
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
    onStateChange?.({
      selectionMode,
      selectedSyllabus,
      selectedLaw,
      questionCount,
      simulacroScope,
      simulacroCount,
      customFrom,
      customTo,
      customOrder,
      customContentScope,
      customTopicMode,
      customTopic,
      customSessionLength,
      customShowMarks,
      customShowNotes,
    });
  }, [
    customContentScope,
    customFrom,
    customOrder,
    customSessionLength,
    customShowMarks,
    customShowNotes,
    customTo,
    customTopic,
    customTopicMode,
    onStateChange,
    questionCount,
    selectedLaw,
    selectedSyllabus,
    selectionMode,
    simulacroCount,
    simulacroScope,
  ]);

  useEffect(() => {
    if (selectionMode !== 'custom') return;
    if (customTopicMode !== 'single') return;
    const scope =
      customContentScope === 'common_only'
        ? 'common'
        : customContentScope === 'specific_only'
          ? 'specific'
          : 'all';
    setCustomTopicsLoading(true);
    setCustomError(null);
    void getCurriculumTopicOptions({ curriculum, questionScope: scope })
      .then((topics) => {
        setCustomTopics(topics);
        if (customTopic && !topics.includes(customTopic)) {
          setCustomTopic('');
        }
      })
      .catch((error) => {
        setCustomTopics([]);
        setCustomError(error instanceof Error ? error.message : isBasque ? 'Ezin izan da gai-zerrenda kargatu.' : 'No se han podido cargar los temas.');
      })
      .finally(() => setCustomTopicsLoading(false));
  }, [curriculum, customContentScope, customTopic, customTopicMode, isBasque, selectionMode]);

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
      if (customTopicMode === 'single' && !customTopic.trim()) {
        setCustomError(isBasque ? 'Aukeratu gai bat.' : 'Elige un tema.');
        return;
      }
      const config: CustomPracticeConfig = {
        curriculum,
        contentScope: usesSingleScope ? 'all_opposition' : customContentScope,
        topicMode:
          customTopicMode === 'single'
            ? { type: 'single_topic', topicId: customTopic.trim() }
            : { type: 'all_topics' },
        sessionLength: customSessionLength,
        supportMode: { showMarks: customShowMarks, showNotes: customShowNotes },
      };
      onStartCustomPractice(config);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16 sm:space-y-8 sm:pb-20">
      <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2.5rem] sm:p-8">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-800 sm:mb-8 sm:text-xl">
          <Zap className="text-indigo-600 w-5 h-5" />
          {isBasque ? 'Nola praktikatu nahi duzu gaur?' : 'Como quieres practicar hoy'}
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 xl:grid-cols-5">
          <button
            onClick={() => setSelectionMode('standard')}
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:p-8 ${
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
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:p-8 ${
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
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:p-8 ${
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
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:p-8 ${
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
              setCustomError(null);
            }}
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:p-8 ${
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
                {isBasque
                  ? 'Aukeratu zatia, gaia eta laguntzak'
                  : 'Elige alcance, tema y ayudas'}
              </p>
            </div>
          </button>
        </div>
      </div>

      {modeNeedsConfig ? (
        <div className="lg:hidden rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
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

              {!usesSingleScope ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {isBasque ? 'Zer ikasi' : 'Qué quieres estudiar'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'all_opposition', label: formatCustomContentScopeLabel('all_opposition') },
                      { id: 'common_only', label: formatCustomContentScopeLabel('common_only') },
                      { id: 'specific_only', label: formatCustomContentScopeLabel('specific_only') },
                      { id: 'common_and_specific', label: formatCustomContentScopeLabel('common_and_specific') },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCustomContentScope(opt.id)}
                        className={`rounded-2xl border-2 px-4 py-4 font-black text-xs transition-all ${
                          customContentScope === opt.id
                            ? 'border-slate-800 bg-slate-50 text-slate-900'
                            : 'border-slate-100 bg-white text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600">
                  {isBasque
                    ? 'Curriculum honek ez du arrunta/espezifikoa bereizten. Test osoa erabiliko da.'
                    : 'Este currículo no separa común/específico. Se usará todo el contenido.'}
                </div>
              )}

              <div className="space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {isBasque ? 'Gaia' : 'Tema'}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomTopicMode('all')}
                    className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                      customTopicMode === 'all'
                        ? 'border-slate-800 bg-slate-50 text-slate-900'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {isBasque ? 'Guztiak' : 'Todos'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTopicMode('single')}
                    className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                      customTopicMode === 'single'
                        ? 'border-slate-800 bg-slate-50 text-slate-900'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {isBasque ? 'Gai bakarra' : 'Un tema'}
                  </button>
                </div>
                {customTopicMode === 'single' ? (
                  <div className="space-y-2">
                    <select
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      disabled={customTopicsLoading}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white disabled:opacity-60"
                    >
                      <option value="">
                        {customTopicsLoading
                          ? isBasque
                            ? 'Kargatzen...'
                            : 'Cargando...'
                          : isBasque
                            ? 'Aukeratu gaia'
                            : 'Elige el tema'}
                      </option>
                      {customTopics.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {isBasque ? 'Luzera' : 'Longitud'}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[5, 10, 20].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCustomSessionLength(count)}
                      className={`rounded-2xl border-2 px-4 py-4 font-black text-lg transition-all ${
                        customSessionLength === count
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-100 bg-white text-slate-500'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {isBasque ? 'Laguntza testean' : 'Apoyo durante el test'}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomShowMarks((v) => !v)}
                    className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                      customShowMarks
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {isBasque ? 'Markak' : 'Marcas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomShowNotes((v) => !v)}
                    className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                      customShowNotes
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {isBasque ? 'Oharrak' : 'Notas'}
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
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <SlidersHorizontal className="text-violet-600 w-5 h-5" />
              {isBasque ? 'Zure neurrira' : 'A tu medida'}
            </h2>
          </div>

          {customError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
              {customError}
            </div>
          ) : null}

          {!usesSingleScope ? (
            <div className="space-y-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Zer ikasi' : 'Qué quieres estudiar'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'all_opposition', label: formatCustomContentScopeLabel('all_opposition') },
                  { id: 'common_only', label: formatCustomContentScopeLabel('common_only') },
                  { id: 'specific_only', label: formatCustomContentScopeLabel('specific_only') },
                  { id: 'common_and_specific', label: formatCustomContentScopeLabel('common_and_specific') },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCustomContentScope(opt.id)}
                    className={`rounded-2xl border-2 px-4 py-4 font-black text-xs transition-all ${
                      customContentScope === opt.id
                        ? 'border-slate-800 bg-slate-50 text-slate-900'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600">
              {isBasque
                ? 'Curriculum honek ez du arrunta/espezifikoa bereizten. Test osoa erabiliko da.'
                : 'Este currículo no separa común/específico. Se usará todo el contenido.'}
            </div>
          )}

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {isBasque ? 'Gaia' : 'Tema'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomTopicMode('all')}
                className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                  customTopicMode === 'all'
                    ? 'border-slate-800 bg-slate-50 text-slate-900'
                    : 'border-slate-100 bg-white text-slate-600'
                }`}
              >
                {isBasque ? 'Guztiak' : 'Todos los temas'}
              </button>
              <button
                type="button"
                onClick={() => setCustomTopicMode('single')}
                className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                  customTopicMode === 'single'
                    ? 'border-slate-800 bg-slate-50 text-slate-900'
                    : 'border-slate-100 bg-white text-slate-600'
                }`}
              >
                {isBasque ? 'Gai bakarra' : 'Un tema'}
              </button>
            </div>
            {customTopicMode === 'single' ? (
              <select
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                disabled={customTopicsLoading}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white disabled:opacity-60"
              >
                <option value="">
                  {customTopicsLoading
                    ? isBasque
                      ? 'Kargatzen...'
                      : 'Cargando...'
                    : isBasque
                      ? 'Aukeratu gaia'
                      : 'Elige el tema'}
                </option>
                {customTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {isBasque ? 'Luzera' : 'Longitud'}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setCustomSessionLength(count)}
                  className={`rounded-2xl border-2 px-4 py-4 font-black text-lg transition-all ${
                    customSessionLength === count
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 bg-white text-slate-500'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {isBasque ? 'Laguntza testean' : 'Apoyo durante el test'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomShowMarks((v) => !v)}
                className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                  customShowMarks
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-100 bg-white text-slate-600'
                }`}
              >
                {isBasque ? 'Markak' : 'Marcas'}
              </button>
              <button
                type="button"
                onClick={() => setCustomShowNotes((v) => !v)}
                className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                  customShowNotes
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-100 bg-white text-slate-600'
                }`}
              >
                {isBasque ? 'Oharrak' : 'Notas'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed left-0 right-0 bottom-[calc(5.9rem+env(safe-area-inset-bottom))] z-50 px-4 sm:px-6 lg:static">
        <button
          onClick={handleStart}
          disabled={selectionMode === 'standard' && usesLawSelection && (!selectedLaw || lawOptions.length === 0)}
          className={`flex w-full items-center justify-center gap-4 rounded-[1.75rem] py-4 text-base font-black shadow-2xl transition-all duration-500 sm:rounded-[2rem] sm:py-6 sm:text-2xl ${
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
      <div className="h-[168px] lg:hidden" />
    </div>
  );
}
