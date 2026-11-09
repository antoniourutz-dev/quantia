import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Hash, Zap, AlertCircle, Timer, SlidersHorizontal } from 'lucide-react';
import {
  SyllabusType,
  formatSyllabusLabel,
  PracticeMode,
  type GeneralLaw,
  type GeneralLawArticle,
  type GeneralLawBlock,
  type GeneralLawSelectionMode,
  type GeneralLawTrainingSelection,
  type Question,
  type ActivePracticeSession,
} from '../types';
import { isLawSelectionCurriculum, isSingleScopeCurriculum, useAppLocale } from '../lib/locale';
import type {
  CustomPracticeConfig,
  CustomPracticeContentScope,
  CustomPracticeSupportMode,
} from '../domain/customPractice/customPracticeTypes';
import { getCurriculumTopicOptionsWithCounts, type CurriculumTopicOption } from '../lib/quantiaApi';
import {
  PRACTICE_MODE_IDS,
  normalizePracticeModeIds,
  type PracticeModeVisibilityId,
} from '../lib/practiceModeVisibility';
import GeneralLawStudySelector from './general-laws/GeneralLawStudySelector';

type SelectionMode = 'standard' | 'quick' | 'errors' | 'simulacro' | 'custom';
type StandardSyllabusSelection = 'mixed' | SyllabusType;
type ReviewSource = 'all' | 'recent_tests' | 'last_day';

export type TestSelectionStateSnapshot = {
  selectionMode: SelectionMode;
  selectedSyllabus: StandardSyllabusSelection;
  selectedLaw: string;
  questionCount: number;
  reviewSource?: ReviewSource;
  reviewTestCount?: number;
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
  onStart: (
    mode: PracticeMode,
    syllabus?: SyllabusType,
    count?: number,
    coachContext?: ActivePracticeSession['coach'] | null,
    reviewPeriod?:
      | { type: 'all' }
      | { type: 'recent_tests'; count: number }
      | { type: 'last_day' },
  ) => void;
  onStartLawTest: (law: string, count?: number) => void;
  onStartCustomTest: (params: { from: number; to: number; randomize: boolean; syllabus?: SyllabusType | null }) => void;
  onStartCustomPractice: (config: CustomPracticeConfig) => void;
  initialSyllabus: SyllabusType | null;
  initialState?: TestSelectionStateSnapshot | null;
  onStateChange?: (state: TestSelectionStateSnapshot) => void;
  visiblePracticeModeIds?: PracticeModeVisibilityId[];
  customSupportMode?: CustomPracticeSupportMode;
  generalLaws?: GeneralLaw[];
  userId?: string | null;
  activeGeneralLawId?: string | null;
  onSelectGeneralLaw?: (lawId: string) => void;
  generalLawBlocks?: GeneralLawBlock[];
  generalLawArticles?: GeneralLawArticle[];
  officialArticleCounts?: Record<string, number>;
  generalLawSelection?: GeneralLawTrainingSelection | null;
  selectedGeneralLawBlockIds?: string[];
  selectedGeneralLawArticleIds?: string[];
  generalLawBlocksLoading?: boolean;
  generalLawArticlesLoading?: boolean;
  generalLawBlockSelectionError?: string | null;
  generalLawArticlesError?: string | null;
  onSetGeneralLawSelectionMode?: (mode: GeneralLawSelectionMode) => void;
  onToggleGeneralLawBlock?: (blockId: string) => void;
  onSelectOnlyGeneralLawBlock?: (blockId: string) => void;
  onSelectAllGeneralLawBlocks?: () => void;
  onClearGeneralLawBlocks?: () => void;
  onSelectGeneralLawBlockGroup?: (blockIds: string[]) => void;
  onClearGeneralLawBlockGroup?: (blockIds: string[]) => void;
  onToggleGeneralLawArticle?: (articleId: string) => void;
  onSelectAllGeneralLawArticles?: () => void;
  onClearGeneralLawArticles?: () => void;
  onSelectGeneralLawArticleGroup?: (articleIds: string[]) => void;
  onClearGeneralLawArticleGroup?: (articleIds: string[]) => void;
  onStartOfficialPractice?: (questions: Question[], title: string) => void;
}

export default function TestSelection({
  curriculum,
  lawOptions,
  initialLaw = null,
  onStart,
  onStartLawTest,
  onStartCustomTest,
  onStartCustomPractice,
  initialSyllabus,
  initialState = null,
  onStateChange,
  visiblePracticeModeIds = [...PRACTICE_MODE_IDS],
  customSupportMode = { showMarks: false, showNotes: false },
  generalLaws = [],
  userId = null,
  activeGeneralLawId = null,
  onSelectGeneralLaw,
  generalLawBlocks = [],
  generalLawArticles = [],
  officialArticleCounts = {},
  generalLawSelection = null,
  selectedGeneralLawBlockIds = [],
  selectedGeneralLawArticleIds = [],
  generalLawBlocksLoading = false,
  generalLawArticlesLoading = false,
  generalLawBlockSelectionError = null,
  generalLawArticlesError = null,
  onSetGeneralLawSelectionMode,
  onToggleGeneralLawBlock,
  onSelectOnlyGeneralLawBlock,
  onSelectAllGeneralLawBlocks,
  onClearGeneralLawBlocks,
  onSelectGeneralLawBlockGroup,
  onClearGeneralLawBlockGroup,
  onToggleGeneralLawArticle,
  onSelectAllGeneralLawArticles,
  onClearGeneralLawArticles,
  onSelectGeneralLawArticleGroup,
  onClearGeneralLawArticleGroup,
  onStartOfficialPractice,
}: TestSelectionProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(initialState?.selectionMode ?? 'standard');
  const [selectedSyllabus, setSelectedSyllabus] = useState<StandardSyllabusSelection>(
    initialState?.selectedSyllabus ?? initialSyllabus ?? 'common',
  );
  const [selectedLaw, setSelectedLaw] = useState<string>(initialState?.selectedLaw ?? initialLaw ?? '');
  const [questionCount, setQuestionCount] = useState<number>(initialState?.questionCount ?? 20);
  const [reviewSource, setReviewSource] = useState<ReviewSource>(initialState?.reviewSource ?? 'all');
  const [reviewTestCount, setReviewTestCount] = useState(initialState?.reviewTestCount ?? 1);
  const options = [10, 20, 50];
  const simulacroOptions = [50, 100];
  const [simulacroScope, setSimulacroScope] = useState<'mixed' | SyllabusType>(initialState?.simulacroScope ?? 'mixed');
  const [simulacroCount, setSimulacroCount] = useState<number>(initialState?.simulacroCount ?? 50);
  const [customFrom, setCustomFrom] = useState<string>(initialState?.customFrom ?? '');
  const [customTo, setCustomTo] = useState<string>(initialState?.customTo ?? '');
  const [customOrder, setCustomOrder] = useState<'sequence' | 'random'>(initialState?.customOrder ?? 'sequence');
  const [customError, setCustomError] = useState<string | null>(null);
  const [customRangeOpen, setCustomRangeOpen] = useState(
    Boolean(initialState?.customFrom?.trim() || initialState?.customTo?.trim()),
  );
  const [standardRangeEnabled, setStandardRangeEnabled] = useState(false);
  const [standardRangeError, setStandardRangeError] = useState<string | null>(null);
  const [customContentScope, setCustomContentScope] = useState<CustomPracticeContentScope>(() => {
    const initialScope = initialState?.customContentScope;
    return !initialScope || initialScope === 'all_opposition' ? 'common_and_specific' : initialScope;
  });
  const [customTopicMode, setCustomTopicMode] = useState<'all' | 'single'>(initialState?.customTopicMode ?? 'all');
  const [customTopic, setCustomTopic] = useState(initialState?.customTopic ?? '');
  const [customTopics, setCustomTopics] = useState<CurriculumTopicOption[]>([]);
  const [customTopicsLoading, setCustomTopicsLoading] = useState(false);
  const initialCustomSessionLength = initialState?.customSessionLength ?? 50;
  const [customSessionLength, setCustomSessionLength] = useState(initialCustomSessionLength);
  const [customSessionLengthInput, setCustomSessionLengthInput] = useState(
    [20, 50, 100].includes(initialCustomSessionLength) ? '' : String(initialCustomSessionLength),
  );
  const [customShowMarks] = useState(customSupportMode.showMarks);
  const [customShowNotes] = useState(customSupportMode.showNotes);
  const normalizedVisiblePracticeModeIds = useMemo(() => {
    const normalized = normalizePracticeModeIds(visiblePracticeModeIds);
    return normalized.length > 0 ? normalized : [...PRACTICE_MODE_IDS];
  }, [visiblePracticeModeIds]);
  const visiblePracticeModeSet = useMemo(
    () => new Set<PracticeModeVisibilityId>(normalizedVisiblePracticeModeIds),
    [normalizedVisiblePracticeModeIds],
  );
  const usesLawSelection = useMemo(() => isLawSelectionCurriculum(curriculum), [curriculum]);
  const usesSingleScope = useMemo(() => isSingleScopeCurriculum(curriculum), [curriculum]);
  const modeNeedsConfig =
    selectionMode === 'standard' ||
    selectionMode === 'errors' ||
    selectionMode === 'simulacro' ||
    selectionMode === 'custom';
  const startLabel =
    selectionMode === 'standard'
      ? isBasque
        ? 'Testa hasi'
        : 'Empezar test'
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
  const activeGeneralLaw = useMemo(
    () => generalLaws.find((law) => law.id === activeGeneralLawId) ?? generalLaws[0] ?? null,
    [activeGeneralLawId, generalLaws],
  );
  const activeGeneralLawLabel =
    activeGeneralLaw?.shortTitle ?? activeGeneralLaw?.title ?? selectedLaw;

  useEffect(() => {
    if (visiblePracticeModeSet.has(selectionMode)) return;
    setSelectionMode(normalizedVisiblePracticeModeIds[0]);
  }, [normalizedVisiblePracticeModeIds, selectionMode, visiblePracticeModeSet]);
  const selectedBlockCount = selectedGeneralLawBlockIds.length;
  const selectedArticleCount = selectedGeneralLawArticleIds.length;
  const publishedBlockCount = generalLawBlocks.length;

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
      reviewSource,
      reviewTestCount,
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
    reviewSource,
    reviewTestCount,
    selectedLaw,
    selectedSyllabus,
    selectionMode,
    simulacroCount,
    simulacroScope,
  ]);

  const COMMON_RANGE_QUESTIONS = 300;
  const SPECIFIC_RANGE_QUESTIONS = 200;
  const MAX_CUSTOM_SESSION_QUESTIONS = 700;
  const getSyllabusRangeLimit = (syllabus?: SyllabusType | null) =>
    syllabus === 'specific' ? SPECIFIC_RANGE_QUESTIONS : COMMON_RANGE_QUESTIONS;
  const getCustomRangeLimit = (scope: CustomPracticeContentScope) =>
    scope === 'specific_only' ? SPECIFIC_RANGE_QUESTIONS : COMMON_RANGE_QUESTIONS;

  const parsePositiveInt = (value: string) => {
    const raw = value.trim();
    if (!raw) return null;
    const parsed = Math.trunc(Number(raw));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const tryBuildRange = (opts: { countFallback: number; allowEmptyTo: boolean; maxQuestions: number }) => {
    const from = parsePositiveInt(customFrom);
    if (!from) return { ok: false as const, error: isBasque ? 'Sartu hasiera zenbaki bat.' : 'Introduce un número de inicio.' };

    const toParsed = parsePositiveInt(customTo);
    const to = toParsed ?? (opts.allowEmptyTo ? from + Math.max(1, opts.countFallback) - 1 : null);
    if (!to) return { ok: false as const, error: isBasque ? 'Sartu amaiera zenbaki bat.' : 'Introduce un número de fin.' };

    if (to < from) {
      return { ok: false as const, error: isBasque ? 'Amaiera hasiera baino txikiagoa da.' : 'El fin no puede ser menor que el inicio.' };
    }

    const total = Math.abs(to - from) + 1;
    if (total > opts.maxQuestions) {
      return {
        ok: false as const,
        error: isBasque
          ? `Tarte handiegia da (gehienez ${opts.maxQuestions} galdera).`
          : `Rango demasiado grande (máx. ${opts.maxQuestions} preguntas).`,
      };
    }

    return { ok: true as const, from, to, randomize: customOrder === 'random' };
  };

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
    void getCurriculumTopicOptionsWithCounts({ curriculum, questionScope: scope })
      .then((topics) => {
        setCustomTopics(topics);
        if (customTopic && !topics.some(({ label }) => label === customTopic)) {
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
        const selectionModeKey = generalLawSelection?.mode ?? 'blocks';
        const hasSelection =
          selectionModeKey === 'articles'
            ? selectedArticleCount > 0
            : selectionModeKey === 'blocks'
              ? selectedBlockCount > 0 || publishedBlockCount === 0
              : false;
        if (!hasSelection) {
          setCustomError(
            selectionModeKey === 'articles'
              ? isBasque
                ? 'Hautatu gutxienez artikulu bat testa hasteko.'
                : 'Selecciona al menos un artículo para empezar el test.'
              : isBasque
                ? 'Hautatu gutxienez bloke bat testa hasteko.'
                : 'Selecciona al menos un bloque para iniciar el test.',
          );
          return;
        }
        onStartLawTest(activeGeneralLawLabel, questionCount);
        return;
      }
      if (standardRangeEnabled) {
        const standardSyllabus = selectedSyllabus === 'mixed' ? null : selectedSyllabus;
        const built = tryBuildRange({
          countFallback: questionCount,
          allowEmptyTo: true,
          maxQuestions: getSyllabusRangeLimit(usesSingleScope ? null : standardSyllabus),
        });
        if (!built.ok) {
          setStandardRangeError(built.error);
          return;
        }
        setStandardRangeError(null);
        onStartCustomTest({
          from: built.from,
          to: built.to,
          randomize: built.randomize,
          syllabus: usesSingleScope ? null : standardSyllabus,
        });
        return;
      }
      onStart(
        'standard',
        usesSingleScope || selectedSyllabus === 'mixed' ? undefined : selectedSyllabus,
        questionCount,
      );
    } else if (selectionMode === 'quick') {
      onStart('quick_five', undefined, 5);
    } else if (selectionMode === 'errors') {
      const reviewPeriod =
        reviewSource === 'recent_tests'
          ? { type: 'recent_tests' as const, count: reviewTestCount }
          : reviewSource === 'last_day'
            ? { type: 'last_day' as const }
            : { type: 'all' as const };
      onStart(
        'review',
        usesSingleScope || usesLawSelection || selectedSyllabus === 'mixed' ? undefined : selectedSyllabus,
        questionCount,
        undefined,
        reviewPeriod,
      );
    } else if (selectionMode === 'simulacro') {
      onStart(
        'simulacro',
        usesSingleScope ? undefined : simulacroScope === 'mixed' ? undefined : simulacroScope,
        simulacroCount,
      );
    } else if (selectionMode === 'custom') {
      const requestedLength = customSessionLengthInput.trim()
        ? parsePositiveInt(customSessionLengthInput)
        : customSessionLength;
      if (!requestedLength || requestedLength > MAX_CUSTOM_SESSION_QUESTIONS) {
        setCustomError(
          isBasque
            ? `Sartu 1 eta ${MAX_CUSTOM_SESSION_QUESTIONS} arteko galdera kopurua.`
            : `Indica una cantidad entre 1 y ${MAX_CUSTOM_SESSION_QUESTIONS} preguntas.`,
        );
        return;
      }
      setCustomSessionLength(requestedLength);
      const hasAnyRange = Boolean(customFrom.trim()) || Boolean(customTo.trim());
      if (hasAnyRange) {
        const built = tryBuildRange({
          countFallback: requestedLength,
          allowEmptyTo: true,
          maxQuestions: usesSingleScope ? COMMON_RANGE_QUESTIONS : getCustomRangeLimit(customContentScope),
        });
        if (!built.ok) {
          setCustomError(built.error);
          return;
        }
        setCustomError(null);
        const syllabus =
          usesSingleScope
            ? null
            : customContentScope === 'common_only'
              ? 'common'
              : customContentScope === 'specific_only'
                ? 'specific'
                : null;
        onStartCustomTest({ from: built.from, to: built.to, randomize: built.randomize, syllabus });
        return;
      }
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
        sessionLength: requestedLength,
        order: customOrder,
        supportMode: { showMarks: customShowMarks, showNotes: customShowNotes },
      };
      onStartCustomPractice(config);
    }
  };

  const renderCustomSessionLengthSelector = (className = '') => (
    <div className={`space-y-3 ${className}`}>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
        {isBasque ? 'Luzera' : 'Longitud'}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[20, 50, 100].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => {
              setCustomSessionLength(count);
              setCustomSessionLengthInput('');
              setCustomError(null);
            }}
            className={`rounded-2xl border-2 px-4 py-4 font-black text-lg transition-all ${
              customSessionLengthInput === '' && customSessionLength === count
                ? 'border-violet-600 bg-violet-50 text-violet-700'
                : 'border-slate-100 bg-white text-slate-500'
            }`}
          >
            {count}
          </button>
        ))}
        <label className="relative">
          <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CUSTOM_SESSION_QUESTIONS}
            value={customSessionLengthInput}
            onChange={(event) => {
              const value = event.target.value;
              setCustomSessionLengthInput(value);
              const parsed = parsePositiveInt(value);
              if (parsed && parsed <= MAX_CUSTOM_SESSION_QUESTIONS) {
                setCustomSessionLength(parsed);
                setCustomError(null);
              }
            }}
            className="h-full min-h-16 w-full rounded-2xl border-2 border-slate-200 bg-white py-4 pl-11 pr-4 text-center text-lg font-black text-slate-700 outline-none focus:border-violet-500"
            placeholder={isBasque ? 'Eskuz' : 'Manual'}
            aria-label={isBasque ? 'Galdera kopurua eskuz' : 'Cantidad manual de preguntas'}
          />
        </label>
      </div>
      <div className="text-xs font-bold text-slate-400">
        {isBasque
          ? `Eskuzko kopurua: 1–${MAX_CUSTOM_SESSION_QUESTIONS}`
          : `Manual: 1–${MAX_CUSTOM_SESSION_QUESTIONS}`}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-3">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          {isBasque ? 'Ordena' : 'Orden'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCustomOrder('sequence')}
            className={`rounded-2xl border-2 px-4 py-3 font-black text-sm transition-all ${
              customOrder === 'sequence'
                ? 'border-violet-600 bg-violet-50 text-violet-700'
                : 'border-slate-100 bg-white text-slate-600'
            }`}
          >
            {isBasque ? 'Ordenean' : 'En orden'}
          </button>
          <button
            type="button"
            onClick={() => setCustomOrder('random')}
            className={`rounded-2xl border-2 px-4 py-3 font-black text-sm transition-all ${
              customOrder === 'random'
                ? 'border-violet-600 bg-violet-50 text-violet-700'
                : 'border-slate-100 bg-white text-slate-600'
            }`}
          >
            {isBasque ? 'Ausaz' : 'Aleatorio'}
          </button>
        </div>
      </div>
    </div>
  );


  const renderGeneralLawBlockSelector = () => {
    if (!usesLawSelection) return null;

    return (
      <GeneralLawStudySelector
        laws={generalLaws}
        userId={userId}
        activeLaw={activeGeneralLaw}
        onSelectLaw={(lawId) => {
          setCustomError(null);
          onSelectGeneralLaw?.(lawId);
        }}
        blocks={generalLawBlocks}
        articles={generalLawArticles}
        officialArticleCounts={officialArticleCounts}
        selection={generalLawSelection}
        blocksLoading={generalLawBlocksLoading}
        articlesLoading={generalLawArticlesLoading}
        selectionError={generalLawBlockSelectionError ?? customError}
        articlesError={generalLawArticlesError}
        isBasque={isBasque}
        onSetMode={(mode) => {
          setCustomError(null);
          onSetGeneralLawSelectionMode?.(mode);
        }}
        onToggleBlock={(blockId) => {
          setCustomError(null);
          onToggleGeneralLawBlock?.(blockId);
        }}
        onSelectOnlyBlock={(blockId) => {
          setCustomError(null);
          onSelectOnlyGeneralLawBlock?.(blockId);
        }}
        onSelectAllBlocks={() => {
          setCustomError(null);
          onSelectAllGeneralLawBlocks?.();
        }}
        onClearBlocks={() => {
          setCustomError(null);
          onClearGeneralLawBlocks?.();
        }}
        onSelectBlockGroup={(blockIds) => {
          setCustomError(null);
          onSelectGeneralLawBlockGroup?.(blockIds);
        }}
        onClearBlockGroup={(blockIds) => {
          setCustomError(null);
          onClearGeneralLawBlockGroup?.(blockIds);
        }}
        onToggleArticle={(articleId) => {
          setCustomError(null);
          onToggleGeneralLawArticle?.(articleId);
        }}
        onSelectAllArticles={() => {
          setCustomError(null);
          onSelectAllGeneralLawArticles?.();
        }}
        onClearArticles={() => {
          setCustomError(null);
          onClearGeneralLawArticles?.();
        }}
        onSelectArticleGroup={(articleIds) => {
          setCustomError(null);
          onSelectGeneralLawArticleGroup?.(articleIds);
        }}
        onClearArticleGroup={(articleIds) => {
          setCustomError(null);
          onClearGeneralLawArticleGroup?.(articleIds);
        }}
        onStartOfficialPractice={onStartOfficialPractice}
      />
    );
  };

  const renderReviewConfiguration = () => (
    <div className="space-y-6 lg:space-y-4">
      <div className="space-y-3">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          {isBasque ? 'Zein akats berrikusi' : 'Qué fallos repasar'}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {([
            { id: 'all', label: isBasque ? 'Akats guztiak' : 'Todos mis fallos' },
            { id: 'recent_tests', label: isBasque ? 'Azken testak' : 'Últimos tests' },
            { id: 'last_day', label: isBasque ? 'Azken 24 orduak' : 'Último día' },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setReviewSource(option.id)}
              className={`rounded-2xl border-2 px-4 py-3 text-left font-black text-sm transition-all ${
                reviewSource === option.id
                  ? 'border-rose-500 bg-rose-50 text-rose-700'
                  : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
          {reviewSource === 'recent_tests' ? (
            <div className="grid grid-cols-4 gap-1 rounded-2xl border border-rose-100 bg-rose-50 p-1">
              {[1, 2, 3, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setReviewTestCount(count)}
                  className={`rounded-xl px-2 py-2 text-sm font-black transition-all ${
                    reviewTestCount === count ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-white'
                  }`}
                  aria-label={isBasque ? `Azken ${count} testak` : `Últimos ${count} tests`}
                >
                  {count}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_auto] lg:items-end lg:gap-4">
      {!usesSingleScope && !usesLawSelection ? (
        <div className="space-y-3">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            {isBasque ? 'Gai-zerrenda' : 'Temario'}
          </div>
          <div className="grid grid-cols-3 gap-2 lg:gap-3">
            {([
              { id: 'mixed', label: isBasque ? 'Biak nahasian' : 'Mixto' },
              { id: 'common', label: formatSyllabusUiLabel('common') },
              { id: 'specific', label: formatSyllabusUiLabel('specific') },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedSyllabus(option.id)}
                className={`rounded-2xl border-2 px-3 py-4 font-black text-xs transition-all lg:px-4 lg:py-3 lg:text-sm ${
                  selectedSyllabus === option.id
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-100 bg-white text-slate-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
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
              className={`rounded-2xl border-2 px-4 py-4 font-black text-lg transition-all lg:py-3 lg:text-xl ${
                questionCount === count
                  ? 'border-rose-500 bg-rose-50 text-rose-700'
                  : 'border-slate-100 bg-white text-slate-500'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 lg:max-w-xs lg:py-3 lg:text-xs">
        {isBasque
          ? 'Hutsegite-tasa handiena lehenengo.'
          : 'Mayor tasa de fallo primero.'}
      </div>
    </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16 sm:space-y-8 sm:pb-20 lg:space-y-3 lg:pb-4">
      <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2.5rem] sm:p-8 lg:rounded-[1.75rem] lg:p-4">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-800 sm:mb-8 sm:text-xl lg:mb-3">
          <Zap className="text-indigo-600 w-5 h-5" />
          {isBasque ? 'Praktika modua' : 'Modo de práctica'}
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] lg:gap-3">
          {visiblePracticeModeSet.has('standard') ? <button
            onClick={() => setSelectionMode('standard')}
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:flex-row lg:justify-center lg:gap-3 lg:rounded-2xl lg:p-3 ${
              selectionMode === 'standard'
                ? 'border-indigo-600 bg-indigo-50 shadow-xl shadow-indigo-100 ring-4 ring-indigo-500/10'
                : 'border-slate-50 bg-white hover:border-indigo-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 lg:p-2 rounded-2xl ${selectionMode === 'standard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <BookOpen size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl lg:text-base text-slate-800 leading-tight">
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
            </div>
          </button> : null}

          {visiblePracticeModeSet.has('quick') ? <button
            onClick={() => setSelectionMode('quick')}
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:flex-row lg:justify-center lg:gap-3 lg:rounded-2xl lg:p-3 ${
              selectionMode === 'quick'
                ? 'border-amber-500 bg-amber-50 shadow-xl shadow-amber-100 ring-4 ring-amber-500/10'
                : 'border-slate-50 bg-white hover:border-amber-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 lg:p-2 rounded-2xl ${selectionMode === 'quick' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Zap size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl lg:text-base text-slate-800 leading-tight">{isBasque ? 'Bloke laburra' : 'Bloque corto'}</p>
            </div>
          </button> : null}

          {visiblePracticeModeSet.has('errors') ? <button
            onClick={() => setSelectionMode('errors')}
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:flex-row lg:justify-center lg:gap-3 lg:rounded-2xl lg:p-3 ${
              selectionMode === 'errors'
                ? 'border-rose-500 bg-rose-50 shadow-xl shadow-rose-100 ring-4 ring-rose-500/10'
                : 'border-slate-50 bg-white hover:border-rose-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 lg:p-2 rounded-2xl ${selectionMode === 'errors' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <AlertCircle size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl lg:text-base text-slate-800 leading-tight">{isBasque ? 'Hutsegiteak zuzendu' : 'Corregir fallos'}</p>
            </div>
          </button> : null}

          {visiblePracticeModeSet.has('simulacro') ? <button
            onClick={() => setSelectionMode('simulacro')}
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:flex-row lg:justify-center lg:gap-3 lg:rounded-2xl lg:p-3 ${
              selectionMode === 'simulacro'
                ? 'border-slate-700 bg-slate-50 shadow-xl shadow-slate-200 ring-4 ring-slate-900/10'
                : 'border-slate-50 bg-white hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div
              className={`p-3 sm:p-4 lg:p-2 rounded-2xl ${
                selectionMode === 'simulacro' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Timer size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl lg:text-base text-slate-800 leading-tight">{isBasque ? 'Simulakroa' : 'Simulacro'}</p>
            </div>
          </button> : null}

          {visiblePracticeModeSet.has('custom') ? <button
            onClick={() => {
              setSelectionMode('custom');
              setCustomError(null);
            }}
            className={`flex flex-col items-center gap-3 rounded-[2rem] border-2 p-4 text-center transition-all duration-500 sm:gap-4 sm:p-7 lg:flex-row lg:justify-center lg:gap-3 lg:rounded-2xl lg:p-3 ${
              selectionMode === 'custom'
                ? 'border-violet-600 bg-violet-50 shadow-xl shadow-violet-100 ring-4 ring-violet-500/10'
                : 'border-slate-50 bg-white hover:border-violet-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-3 sm:p-4 lg:p-2 rounded-2xl ${selectionMode === 'custom' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <SlidersHorizontal size={26} />
            </div>
            <div>
              <p className="font-black text-sm sm:text-xl lg:text-base text-slate-800 leading-tight">
                {isBasque ? 'Zure neurrira' : 'A tu medida'}
              </p>
            </div>
          </button> : null}
        </div>
      </div>

      {modeNeedsConfig ? (
        <div className="lg:hidden rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          {selectionMode === 'standard' ? (
            <div className="space-y-6">
              {!usesSingleScope ? (
                usesLawSelection ? (
                  renderGeneralLawBlockSelector()
                ) : (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Gai-zerrenda' : 'Temario'}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSyllabus('mixed')}
                        className={`rounded-2xl border-2 px-3 py-4 font-black text-xs transition-all ${
                          selectedSyllabus === 'mixed'
                            ? 'border-slate-800 bg-slate-50 text-slate-900'
                            : 'border-slate-100 bg-white text-slate-600'
                        }`}
                      >
                        {isBasque ? 'Biak nahasian' : 'Mixto'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSyllabus('common')}
                        className={`rounded-2xl border-2 px-3 py-4 font-black text-xs transition-all ${
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
                        className={`rounded-2xl border-2 px-3 py-4 font-black text-xs transition-all ${
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

              {!usesLawSelection ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      <span className="sr-only">{isBasque ? 'Aukerak' : 'Opciones'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStandardRangeEnabled((prev) => !prev);
                        setStandardRangeError(null);
                      }}
                      className={`rounded-2xl border px-4 py-2 text-[11px] font-black transition-all ${
                        standardRangeEnabled
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {standardRangeEnabled
                        ? isBasque
                          ? 'Tartea aktibo'
                          : 'Rango activo'
                        : isBasque
                          ? 'Tartea aukeratu'
                          : 'Rango'}
                    </button>
                  </div>

                  {standardRangeEnabled ? (
                    <div className="space-y-3">
                      {standardRangeError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                          {standardRangeError}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            {isBasque ? 'Hasieratik' : 'Desde'}
                          </div>
                          <div className="relative">
                            <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              inputMode="numeric"
                              value={customFrom}
                              onChange={(e) => {
                                setCustomFrom(e.target.value);
                                setStandardRangeError(null);
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                              placeholder={isBasque ? 'Adib. 120' : 'Ej. 120'}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            {isBasque ? 'Amaiera (auk.)' : 'Hasta (opc.)'}
                          </div>
                          <div className="relative">
                            <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              inputMode="numeric"
                              value={customTo}
                              onChange={(e) => {
                                setCustomTo(e.target.value);
                                setStandardRangeError(null);
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                              placeholder={isBasque ? `Hutsik = ${questionCount} galdera` : `Vacío = ${questionCount} preguntas`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCustomOrder('sequence')}
                          className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                            customOrder === 'sequence'
                              ? 'border-slate-800 bg-slate-50 text-slate-900'
                              : 'border-slate-100 bg-white text-slate-600'
                          }`}
                        >
                          {isBasque ? 'Ordenean' : 'En orden'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomOrder('random')}
                          className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                            customOrder === 'random'
                              ? 'border-slate-800 bg-slate-50 text-slate-900'
                              : 'border-slate-100 bg-white text-slate-600'
                          }`}
                        >
                          {isBasque ? 'Ausaz' : 'Aleatorio'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {selectionMode === 'errors' ? renderReviewConfiguration() : null}

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
            <div className="flex flex-col gap-6">
              {customError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                  {customError}
                </div>
              ) : null}

              <div className="order-4 space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCustomRangeOpen((open) => !open)}
                    aria-expanded={customRangeOpen}
                    className="flex flex-1 items-center justify-between gap-3 text-left"
                  >
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {isBasque ? 'Tartea (aukerakoa)' : 'Rango (opcional)'}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${customRangeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {(customFrom.trim() || customTo.trim()) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomFrom('');
                        setCustomTo('');
                        setCustomError(null);
                      }}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-100"
                    >
                      {isBasque ? 'Garbitu' : 'Limpiar'}
                    </button>
                  ) : null}
                </div>

                {customRangeOpen ? <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      inputMode="numeric"
                      value={customFrom}
                      onChange={(e) => {
                        setCustomFrom(e.target.value);
                        setCustomError(null);
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      placeholder={isBasque ? 'Desde' : 'Desde'}
                    />
                  </div>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      inputMode="numeric"
                      value={customTo}
                      onChange={(e) => {
                        setCustomTo(e.target.value);
                        setCustomError(null);
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      placeholder={isBasque ? 'Amaiera (auk.)' : 'Hasta (opcional)'}
                    />
                  </div>
                </div> : null}
              </div>

              {!usesSingleScope ? (
                <div className="order-1 space-y-3">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {isBasque ? 'Zer ikasi' : 'Qué quieres estudiar'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
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
                <div className="order-1 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600">
                  {isBasque
                    ? 'Curriculum honek ez du arrunta/espezifikoa bereizten. Test osoa erabiliko da.'
                    : 'Este currículo no separa común/específico. Se usará todo el contenido.'}
                </div>
              )}

              <div className="order-2 space-y-3">
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
                      {customTopics.map(({ label, count }) => (
                        <option key={label} value={label}>
                          {`${label} (${count} ${isBasque ? 'galdera' : count === 1 ? 'pregunta' : 'preguntas'})`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {renderCustomSessionLengthSelector('order-3')}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectionMode === 'standard' && !usesSingleScope ? (
        <div className="hidden lg:block">
        <div className="bg-white p-8 lg:p-4 rounded-[2.5rem] lg:rounded-[1.75rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-bold text-slate-800 mb-8 lg:mb-3 flex items-center gap-2">
            <BookOpen className="text-indigo-600 w-5 h-5" />
            {usesLawSelection
              ? isBasque
                ? 'Legea'
                : 'Ley'
              : isBasque
                ? 'Gai-zerrenda'
                : 'Temario'}
          </h2>

          {usesLawSelection ? (
            renderGeneralLawBlockSelector()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-3">
              <button
                onClick={() => setSelectedSyllabus('mixed')}
                className={`p-6 lg:p-3 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 lg:gap-3 ${
                  selectedSyllabus === 'mixed'
                    ? 'border-slate-800 bg-slate-50'
                    : 'border-slate-50 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedSyllabus === 'mixed' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg lg:text-sm text-slate-800">
                  {isBasque ? 'Biak nahasian' : 'Mixto'}
                </span>
              </button>
              <button
                onClick={() => setSelectedSyllabus('common')}
                className={`p-6 lg:p-3 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 lg:gap-3 ${
                  selectedSyllabus === 'common'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-50 bg-white hover:border-indigo-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedSyllabus === 'common' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg lg:text-sm text-slate-800">
                  {formatSyllabusUiLabel('common')}
                </span>
              </button>

              <button
                onClick={() => setSelectedSyllabus('specific')}
                className={`p-6 lg:p-3 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 lg:gap-3 ${
                  selectedSyllabus === 'specific'
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-50 bg-white hover:border-emerald-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${selectedSyllabus === 'specific' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg lg:text-sm text-slate-800">
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
        <div className="bg-white p-8 lg:p-4 rounded-[2.5rem] lg:rounded-[1.75rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-bold text-slate-800 mb-8 lg:mb-3 flex items-center gap-2">
            <Hash className="text-indigo-600 w-5 h-5" />
            {isBasque ? 'Galderak' : 'Preguntas'}
          </h2>

          <div className="grid grid-cols-3 gap-6 lg:gap-3">
            {options.map((count) => (
              <button
                key={count}
                onClick={() => setQuestionCount(count)}
                className={`py-6 px-8 lg:px-5 lg:py-3 rounded-2xl border-2 transition-all duration-300 font-black text-2xl lg:text-xl ${
                  questionCount === count
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-50 bg-white text-slate-400 hover:border-indigo-100'
                }`}
              >
                {count}
              </button>
            ))}
          </div>

          {!usesLawSelection ? (
            <div className="mt-8 space-y-4 lg:mt-3 lg:space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  <span className="sr-only">{isBasque ? 'Aukerak' : 'Opciones'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStandardRangeEnabled((prev) => !prev);
                    setStandardRangeError(null);
                  }}
                  className={`rounded-2xl border px-4 py-2 text-[11px] font-black transition-all ${
                    standardRangeEnabled
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {standardRangeEnabled
                    ? isBasque
                      ? 'Tartea aktibo'
                      : 'Rango activo'
                    : isBasque
                      ? 'Tartea aukeratu'
                      : 'Rango'}
                </button>
              </div>

              {standardRangeEnabled ? (
                <div className="space-y-4">
                  {standardRangeError ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                      {standardRangeError}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        {isBasque ? 'Hasieratik' : 'Desde'}
                      </div>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          inputMode="numeric"
                          value={customFrom}
                          onChange={(e) => {
                            setCustomFrom(e.target.value);
                            setStandardRangeError(null);
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                          placeholder={isBasque ? 'Adib. 120' : 'Ej. 120'}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        {isBasque ? 'Amaiera (auk.)' : 'Hasta (opc.)'}
                      </div>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          inputMode="numeric"
                          value={customTo}
                          onChange={(e) => {
                            setCustomTo(e.target.value);
                            setStandardRangeError(null);
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                          placeholder={isBasque ? `Hutsik = ${questionCount} galdera` : `Vacío = ${questionCount} preguntas`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <button
                      type="button"
                      onClick={() => setCustomOrder('sequence')}
                      className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                        customOrder === 'sequence'
                          ? 'border-slate-800 bg-slate-50 text-slate-900'
                          : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isBasque ? 'Ordenean' : 'En orden'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomOrder('random')}
                      className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                        customOrder === 'random'
                          ? 'border-slate-800 bg-slate-50 text-slate-900'
                          : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isBasque ? 'Ausaz' : 'Aleatorio'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
      ) : null}

      {selectionMode === 'errors' ? (
        <div className="hidden lg:block">
          <div className="space-y-8 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 lg:space-y-3 lg:rounded-[1.75rem] lg:p-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              {isBasque ? 'Hutsegiteak zuzendu' : 'Corregir fallos'}
            </h2>
            {renderReviewConfiguration()}
          </div>
        </div>
      ) : null}

      {selectionMode === 'simulacro' ? (
        <div className="hidden lg:block">
        <div className="bg-white p-8 lg:p-4 rounded-[2.5rem] lg:rounded-[1.75rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500 space-y-8 lg:space-y-3">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Timer className="text-slate-700 w-5 h-5" />
            {isBasque ? 'Simulakroa' : 'Simulacro'}
          </h2>

          {!usesSingleScope ? (
            <div className="space-y-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Azterketaren zatia' : 'Parte del examen'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-3">
                <button
                  onClick={() => setSimulacroScope('mixed')}
                  className={`p-6 lg:p-3 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 lg:gap-3 ${
                    simulacroScope === 'mixed'
                      ? 'border-slate-800 bg-slate-50'
                      : 'border-slate-50 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${simulacroScope === 'mixed' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="font-bold text-lg lg:text-sm text-slate-800">{isBasque ? 'Mistoa' : 'Mixto'}</span>
                </button>

                <button
                  onClick={() => setSimulacroScope('common')}
                  className={`p-6 lg:p-3 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 lg:gap-3 ${
                    simulacroScope === 'common'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-50 bg-white hover:border-indigo-100'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${simulacroScope === 'common' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="font-bold text-lg lg:text-sm text-slate-800">
                    {formatSyllabusUiLabel('common')}
                  </span>
                </button>

                <button
                  onClick={() => setSimulacroScope('specific')}
                  className={`p-6 lg:p-3 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 lg:gap-3 ${
                    simulacroScope === 'specific'
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-50 bg-white hover:border-emerald-100'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${simulacroScope === 'specific' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="font-bold text-lg lg:text-sm text-slate-800">
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
            <div className="grid grid-cols-2 gap-6 lg:gap-3">
              {simulacroOptions.map((count) => (
                <button
                  key={count}
                  onClick={() => setSimulacroCount(count)}
                  className={`py-6 px-8 lg:py-3 rounded-2xl border-2 transition-all duration-300 font-black text-2xl lg:text-xl ${
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
                : 'Resultados al finalizar.'}
            </div>
          </div>
        </div>
        </div>
      ) : null}

      {selectionMode === 'custom' ? (
        <div className="hidden lg:block">
        <div className="bg-white p-6 sm:p-8 lg:p-4 rounded-[2.5rem] lg:rounded-[1.75rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500 space-y-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {customError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 lg:col-span-2 lg:py-3">
              {customError}
            </div>
          ) : null}

          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 lg:order-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCustomRangeOpen((open) => !open)}
                aria-expanded={customRangeOpen}
                className="flex flex-1 items-center justify-between gap-3 text-left"
              >
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {isBasque ? 'Tartea (aukerakoa)' : 'Rango (opcional)'}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${customRangeOpen ? 'rotate-180' : ''}`} />
              </button>
              {(customFrom.trim() || customTo.trim()) ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomFrom('');
                    setCustomTo('');
                    setCustomError(null);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-100"
                >
                  {isBasque ? 'Garbitu' : 'Limpiar'}
                </button>
              ) : null}
            </div>

            {customRangeOpen ? <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  inputMode="numeric"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    setCustomError(null);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400"
                  placeholder={isBasque ? 'Desde' : 'Desde'}
                />
              </div>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  inputMode="numeric"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    setCustomError(null);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400"
                  placeholder={isBasque ? 'Amaiera (auk.)' : 'Hasta (opcional)'}
                />
              </div>
            </div> : null}

          </div>

          {!usesSingleScope ? (
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 lg:order-1">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Edukia' : 'Contenido'}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
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
                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                        : 'border-slate-100 bg-white text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-5 py-4 text-sm font-bold text-slate-600 lg:order-1">
              {isBasque
                ? 'Curriculum honek ez du arrunta/espezifikoa bereizten. Test osoa erabiliko da.'
                : 'Este currículo no separa común/específico. Se usará todo el contenido.'}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 lg:order-2">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {isBasque ? 'Gaia' : 'Tema'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomTopicMode('all')}
                className={`rounded-2xl border-2 px-4 py-4 font-black text-sm transition-all ${
                  customTopicMode === 'all'
                    ? 'border-violet-600 bg-violet-50 text-violet-700'
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
                    ? 'border-violet-600 bg-violet-50 text-violet-700'
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
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400 disabled:opacity-60"
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
                {customTopics.map(({ label, count }) => (
                  <option key={label} value={label}>
                    {`${label} (${count} ${isBasque ? 'galdera' : count === 1 ? 'pregunta' : 'preguntas'})`}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {renderCustomSessionLengthSelector(
            'rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 lg:order-3 lg:col-span-2',
          )}
        </div>
        </div>
      ) : null}

      <div className="fixed left-0 right-0 bottom-[calc(5.9rem+env(safe-area-inset-bottom))] z-50 px-4 sm:px-6 lg:static lg:mx-auto lg:max-w-xl">
        <button
          onClick={handleStart}
          disabled={selectionMode === 'standard' && usesLawSelection && !activeGeneralLaw && (!selectedLaw || lawOptions.length === 0)}
          className={`flex w-full items-center justify-center gap-4 rounded-[1.75rem] py-4 text-base font-black shadow-2xl transition-all duration-500 sm:rounded-[2rem] sm:py-6 sm:text-2xl lg:rounded-2xl lg:py-3 lg:text-lg ${
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
