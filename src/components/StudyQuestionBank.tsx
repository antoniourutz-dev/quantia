import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, CheckCircle2, Info, Search, X } from 'lucide-react';
import {
  formatSyllabusLabel,
  type GeneralLaw,
  type GeneralLawArticle,
  type GeneralLawBlock,
  type GeneralLawSelectionMode,
  type GeneralLawTrainingSelection,
  type PracticeQuestionScopeFilter,
  type Question,
  type QuestionBankListItem,
} from '../types';
import { isLawSelectionCurriculum, isSingleScopeCurriculum, useAppLocale } from '../lib/locale';
import { getCurriculumCategoryGroupLabel, getQuestionBankPage, getQuestionBankQuestionDetail, getQuestionBankTopicOptions, type CurriculumTopicOption } from '../lib/quantiaApi';
import EditorialExplanation from './EditorialExplanation';
import GeneralLawStudySelector from './general-laws/GeneralLawStudySelector';
import { createId } from '../lib/id';
import { recordQuestionView } from '../lib/questionActivity';

type StudyScope = PracticeQuestionScopeFilter;

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [100, 50] as const;

const toAnswerLabel = (value: QuestionBankListItem['correctAnswer']) => value?.toUpperCase() ?? '—';

const formatScopeLabel = (scope: StudyScope, locale: 'es' | 'eu', curriculum: string) => {
  if (scope === 'all') return locale === 'eu' ? 'Denak' : 'Todos';
  return formatSyllabusLabel(scope, locale, { curriculum, variant: 'compact' });
};

export default function StudyQuestionBank({
  curriculum,
  generalLaw = null,
  userId = null,
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
  onOpenGuidedStudy,
}: {
  curriculum: string;
  generalLaw?: GeneralLaw | null;
  userId?: string | null;
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
  onOpenGuidedStudy?: (() => void) | null;
}) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);
  const usesOnlySpecificScope = isSingleScopeCurriculum(curriculum) || isLawSelectionCurriculum(curriculum);
  const initialScope = usesOnlySpecificScope ? 'specific' : 'common';

  const [scope, setScope] = useState<StudyScope>(initialScope);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [topicOptions, setTopicOptions] = useState<CurriculumTopicOption[]>([]);
  const [topicOptionsLoading, setTopicOptionsLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageItems, setPageItems] = useState<QuestionBankListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);

  const deferredSearchInput = useDeferredValue(searchInput);
  const searchTerm = deferredSearchInput.trim();
  const searchKey = searchTerm.toLowerCase();
  const gridRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDialogElement>(null);
  const detailCacheRef = useRef(new Map<string, Question>());
  const activitySessionIdRef = useRef(`question-bank-${createId()}`);
  const viewOccurrencesRef = useRef(new Map<string, number>());
  const questionFilters = useMemo(
    () =>
      isLawSelectionCurriculum(curriculum) && generalLaw
        ? generalLawSelection?.mode === 'articles'
          ? {
              generalLawId: generalLaw.id,
              generalLawArticleIds: selectedGeneralLawArticleIds,
            }
          : {
              generalLawId: generalLaw.id,
              generalLawBlockIds: selectedGeneralLawBlockIds,
            }
        : null,
    [curriculum, generalLaw, generalLawSelection?.mode, selectedGeneralLawArticleIds, selectedGeneralLawBlockIds],
  );

  const listErrorMessage = t(
    'No se han podido cargar las preguntas.',
    'Ezin izan dira galderak kargatu.',
  );
  const detailErrorMessage = t(
    'No se ha podido cargar la pregunta seleccionada.',
    'Ezin izan da hautatutako galdera kargatu.',
  );

  const scopeLabels = useMemo<StudyScope[]>(
    () => (usesOnlySpecificScope ? ['specific'] : ['common', 'specific']),
    [usesOnlySpecificScope],
  );

  useEffect(() => {
    if (scopeLabels.includes(scope)) return;
    setScope(scopeLabels[0]);
  }, [scope, scopeLabels]);

  useEffect(() => {
    setSelectedTopic('');
  }, [curriculum, scope]);

  useEffect(() => {
    let cancelled = false;
    setTopicOptionsLoading(true);
    getQuestionBankTopicOptions({ curriculum, questionScope: scope, filters: questionFilters })
      .then((options) => {
        if (cancelled) return;
        setTopicOptions(options);
        setSelectedTopic((current) =>
          current && !options.some(({ label }) => label === current) ? '' : current,
        );
      })
      .catch(() => {
        if (!cancelled) setTopicOptions([]);
      })
      .finally(() => {
        if (!cancelled) setTopicOptionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [curriculum, scope, questionFilters]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedId(null);
    setSelectedQuestion(null);
    setExplanationOpen(false);
    setPageItems([]);
    setHasNextPage(false);
    setError(null);
  }, [curriculum, scope, searchKey, selectedTopic]);

  useEffect(() => {
    if (!userId || !selectedQuestion) return;
    const occurrence = (viewOccurrencesRef.current.get(selectedQuestion.id) ?? 0) + 1;
    viewOccurrencesRef.current.set(selectedQuestion.id, occurrence);
    recordQuestionView({
      userId,
      curriculum,
      sessionId: activitySessionIdRef.current,
      eventId: `${activitySessionIdRef.current}:bank:${selectedQuestion.id}:${occurrence}`,
      surface: 'question-bank',
      mode: 'question-bank',
      question: selectedQuestion,
    });
  }, [curriculum, selectedQuestion, userId]);

  useEffect(() => {
    let cancelled = false;

    setListLoading(true);
    setError(null);

    getQuestionBankPage({
      curriculum,
      questionScope: scope,
      page: pageIndex,
      pageSize,
      search: searchTerm,
      topic: selectedTopic,
      filters: questionFilters,
    })
      .then((page) => {
        if (cancelled) return;
        setPageItems(page.items);
        setHasNextPage(page.hasNextPage);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : listErrorMessage);
        setPageItems([]);
        setHasNextPage(false);
      })
      .finally(() => {
        if (cancelled) return;
        setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [curriculum, listErrorMessage, pageIndex, pageSize, questionFilters, scope, searchTerm, selectedTopic]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedQuestion(null);
      setExplanationOpen(false);
      return;
    }

    const cached = detailCacheRef.current.get(selectedId);
    if (cached) {
      setSelectedQuestion(cached);
      setExplanationOpen(false);
      return;
    }

    let cancelled = false;
    setExplanationOpen(false);

    getQuestionBankQuestionDetail({
      curriculum,
      questionId: selectedId,
      questionScope: scope,
    })
      .then((question) => {
        if (cancelled) return;
        detailCacheRef.current.set(selectedId, question);
        setSelectedQuestion(question);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err instanceof Error ? err.message : detailErrorMessage);
        setSelectedQuestion(null);
      });

    return () => {
      cancelled = true;
    };
  }, [curriculum, detailErrorMessage, scope, selectedId]);

  const firstResult = pageIndex * pageSize + 1;
  const lastResult = firstResult + pageItems.length - 1;
  const pageSummary = listLoading
    ? t('Cargando preguntas…', 'Galderak kargatzen…')
    : pageItems.length
      ? `${t('Resultados', 'Emaitzak')} ${firstResult}–${lastResult}`
      : t('Sin resultados', 'Emaitzarik ez');

  const changePage = (delta: number) => {
    setPageIndex(page => Math.max(0, page + delta));
    gridRef.current?.scrollIntoView({ block: 'nearest' });
  };

  const getDisplayNumber = (question: QuestionBankListItem, indexInPage: number) => {
    if (typeof question.number === 'number' && Number.isFinite(question.number)) return question.number;
    return pageIndex * pageSize + indexInPage + 1;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            <BookOpen size={21} className="text-indigo-600" aria-hidden="true" />
            {t('Banco de preguntas', 'Galdera-bankua')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t('Filtra por temario o tema y abre una pregunta para consultar su respuesta y explicación.', 'Iragazi gai-zerrendaren edo gaiaren arabera, eta ireki galdera bat erantzuna eta azalpena ikusteko.')}
          </p>
        </div>

        {onOpenGuidedStudy ? (
          <button
            type="button"
            onClick={onOpenGuidedStudy}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            {t('Estudio guiado', 'Ikasketa gidatua')}
          </button>
        ) : null}
      </div>

      {isLawSelectionCurriculum(curriculum) && generalLaw ? (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <GeneralLawStudySelector
            laws={[generalLaw]}
            userId={userId}
            activeLaw={generalLaw}
            blocks={generalLawBlocks}
            articles={generalLawArticles}
            officialArticleCounts={officialArticleCounts}
            selection={generalLawSelection}
            blocksLoading={generalLawBlocksLoading}
            articlesLoading={generalLawArticlesLoading}
            selectionError={generalLawBlockSelectionError}
            articlesError={generalLawArticlesError}
            isBasque={isBasque}
            compact
            onSetMode={onSetGeneralLawSelectionMode}
            onToggleBlock={onToggleGeneralLawBlock}
            onSelectOnlyBlock={onSelectOnlyGeneralLawBlock}
            onSelectAllBlocks={onSelectAllGeneralLawBlocks}
            onClearBlocks={onClearGeneralLawBlocks}
            onSelectBlockGroup={onSelectGeneralLawBlockGroup}
            onClearBlockGroup={onClearGeneralLawBlockGroup}
            onToggleArticle={onToggleGeneralLawArticle}
            onSelectAllArticles={onSelectAllGeneralLawArticles}
            onClearArticles={onClearGeneralLawArticles}
            onSelectArticleGroup={onSelectGeneralLawArticleGroup}
            onClearArticleGroup={onClearGeneralLawArticleGroup}
            onStartOfficialPractice={onStartOfficialPractice}
          />
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-5 space-y-5">
        <div className="grid gap-3 border-b border-slate-200 pb-4 sm:grid-cols-2 xl:grid-cols-[auto_minmax(0,1.25fr)_minmax(0,1fr)] xl:items-end">
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-semibold text-slate-700">{t('Temario', 'Gai-zerrenda')}</legend>
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {scopeLabels.map(value => (
                <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value}
                  className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${scope === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-indigo-700'}`}>
                  {formatScopeLabel(value, locale, curriculum)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="min-w-0 space-y-1.5 text-xs font-semibold text-slate-700">
            <span className="block">{t('Tema', 'Gaia')}</span>
            <select value={selectedTopic} onChange={event => setSelectedTopic(event.target.value)} disabled={topicOptionsLoading}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-indigo-500 disabled:opacity-60">
              <option value="">{topicOptionsLoading ? t('Cargando temas…', 'Gaiak kargatzen…') : t('Todos los temas', 'Gai guztiak')}</option>
              {topicOptions.map(({ label, count }) => <option value={label} key={label}>{label} ({count})</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-xs font-semibold text-slate-700 sm:col-span-2 xl:col-span-1">
            <span className="block">{t('Buscar', 'Bilatu')}</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 focus:border-indigo-500"
                placeholder={t('Número o texto', 'Zenbakia edo testua')} />
            </span>
          </label>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-bold">
            {error}
          </div>
        ) : null}

        <div ref={gridRef} className="scroll-mt-24 space-y-3 xl:scroll-mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">{t('Preguntas', 'Galderak')}</h3>
              <p aria-live="polite" className="text-xs tabular-nums text-slate-600">{pageSummary}</p>
            </div>

            {pageItems.some((item) => item.auditIncident) ? (
              <p className="mb-3 text-xs font-semibold text-amber-800">
                <span className="mr-1 font-black text-amber-600">*</span>
                {t('El asterisco señala una incidencia o un matiz normativo. Consulta la explicación.', 'Izartxoak araudi-gorabehera edo ñabardura adierazten du. Ikusi azalpena.')}
              </p>
            ) : null}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
              {listLoading ? (
                <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500 font-bold">
                  {t('Cargando preguntas...', 'Galderak kargatzen...')}
                </div>
              ) : pageItems.length === 0 ? (
                <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500 font-bold leading-relaxed">
                  {t(
                    'No hay preguntas disponibles con este filtro. Prueba cambiando de temario o ajustando la búsqueda.',
                    'Ez dago galderarik iragazki honekin. Saiatu gai-zerrenda aldatzen edo bilaketa doitzen.',
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2">
                  {pageItems.map((question, index) => {
                    const isSelected = selectedId === question.id;
                    const displayNumber = getDisplayNumber(question, index);

                    return (
                      <button
                        key={question.id}
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => {
                          setSelectedQuestion(null);
                          setDetailError(null);
                          setExplanationOpen(false);
                          setSelectedId(question.id);
                          detailRef.current?.showModal();
                        }}
                        aria-label={`${t('Pregunta', 'Galdera')} ${displayNumber}${question.auditIncident ? t(', con incidencia', ', gorabeherarekin') : ''}`}
                        className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border py-1 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                          question.auditIncident
                            ? isSelected
                              ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-400/40'
                              : 'border-amber-300 bg-amber-50 hover:border-amber-500'
                            : isSelected
                              ? 'border-indigo-400 bg-indigo-50 shadow-indigo-200/30'
                              : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-200/20'
                        }`}
                      >
                        <div className={`text-[11px] font-semibold tabular-nums ${question.auditIncident ? 'text-amber-800' : 'text-slate-400'}`}>
                          {displayNumber}
                        </div>
                        {question.auditIncident ? (
                          <span className="absolute right-1 top-0.5 text-sm font-black text-amber-600" aria-hidden="true">*</span>
                        ) : null}
                        <div className={`rounded-md border px-1.5 py-0.5 text-xs font-black leading-none ${
                            question.auditIncident
                              ? 'border-amber-300 bg-amber-100 text-amber-900'
                              : 'border-slate-200 bg-slate-50 text-slate-900'
                          }`}>
                            {question.auditIncident && !question.correctAnswer ? '?' : toAnswerLabel(question.correctAnswer)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          <nav aria-label={t('Paginación del banco', 'Bankuaren orrialdeak')} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              {t('Por página', 'Orriko')}
              <select value={pageSize} onChange={event => {
                setPageSize(Number(event.target.value));
                setPageIndex(0);
              }} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                {PAGE_SIZE_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => changePage(-1)} aria-label={t('Página anterior', 'Aurreko orria')}
                disabled={pageIndex === 0 || listLoading}
                className="flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-indigo-50 disabled:opacity-40">
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="px-2 text-sm font-bold tabular-nums text-slate-800">{t('Página', 'Orria')} {pageIndex + 1}</span>
              <button type="button" onClick={() => changePage(1)} aria-label={t('Página siguiente', 'Hurrengo orria')}
                disabled={!hasNextPage || listLoading}
                className="flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-indigo-50 disabled:opacity-40">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </nav>
        </div>
      </div>

      <dialog ref={detailRef} aria-labelledby="question-bank-detail-title"
        onClose={() => setSelectedId(null)}
        onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
        className="m-auto max-h-[min(90dvh,52rem)] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <h3 id="question-bank-detail-title" className="text-sm font-bold text-slate-800">{t('Detalle de la pregunta', 'Galderaren xehetasuna')}</h3>
          <button type="button" onClick={() => detailRef.current?.close()} aria-label={t('Cerrar detalle', 'Xehetasuna itxi')}
            className="flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {selectedId && (detailError ? (
            <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{detailError}</p>
          ) : !selectedQuestion ? (
            <p role="status" className="py-6 text-sm text-slate-600">{t('Cargando detalle de la pregunta…', 'Galderaren xehetasuna kargatzen…')}</p>
          ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {t('Pregunta', 'Galdera')} {selectedQuestion.number ?? '—'}
                      </div>
                      <h2 className="mt-2 text-[15px] font-extrabold leading-[1.35] text-slate-800 sm:text-lg">
                        {selectedQuestion.auditIncident && <span role="img" aria-label={t('Pregunta con incidencia', 'Gorabehera duen galdera')} className="mr-1 font-black text-amber-600">*</span>}
                        {selectedQuestion.text}
                      </h2>
                      {selectedQuestion.auditIncident && <p className="mt-2 text-sm font-medium text-amber-800">{selectedQuestion.auditSeverity === 'warning' ? t('Respuesta validada con advertencia normativa. Consulta el matiz de la explicación.', 'Erantzun balioztatua araudi-oharrarekin. Ikusi azalpena.') : t('Pregunta conflictiva: la letra registrada no es una solución jurídica indiscutible. Consulta la explicación.', 'Galdera gatazkatsua: bankuko erantzuna ez da zalantzarik gabekoa. Ikusi azalpena.')}</p>}
                      {selectedQuestion.category ? (
                        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                          {getCurriculumCategoryGroupLabel(curriculum, selectedQuestion.category) ??
                            selectedQuestion.category}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 px-3 py-2 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                      {formatScopeLabel(selectedQuestion.syllabus, locale, curriculum)}
                    </div>
                  </div>

                <div className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white">
                  {selectedQuestion.options.map((option) => {
                    const isReferenceAnswer = Boolean(selectedQuestion.auditIncident && selectedQuestion.auditSeverity !== 'warning' && option.id === selectedQuestion.correctAnswer);
                    const isCorrect = (!selectedQuestion.auditIncident || selectedQuestion.auditSeverity === 'warning') && option.id === selectedQuestion.correctAnswer;

                    return (
                      <div
                        key={option.id}
                        className={`relative flex items-start gap-4 p-4 sm:p-5 ${
                          isCorrect ? 'bg-emerald-50/60' : isReferenceAnswer ? 'bg-amber-50/70' : 'bg-white'
                        }`}
                      >
                        <div
                          className={`mt-0.5 h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center font-black ${
                            isCorrect
                              ? 'border-emerald-200 bg-white text-emerald-700'
                              : isReferenceAnswer
                                ? 'border-amber-300 bg-amber-100 text-amber-900'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {option.id.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 text-sm sm:text-base font-bold leading-snug text-slate-700">
                          {option.text}
                          {isReferenceAnswer && (
                            <div className="mt-2 text-xs font-semibold text-amber-800">
                              <span className="mr-1 text-amber-600">*</span>
                              {t('Respuesta registrada en el banco, no necesariamente válida sin reservas. Consulta la incidencia.', 'Bankuan gordetako erantzuna, ez nahitaez zalantzarik gabe baliozkoa. Ikusi gorabehera.')}
                            </div>
                          )}
                        </div>
                        {isCorrect ? <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-600 shrink-0" /> : null}
                      </div>
                    );
                  })}
                </div>

                  {!explanationOpen ? (
                    <button
                      type="button"
                      onClick={() => setExplanationOpen(true)}
                      className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-2 text-xs font-bold text-indigo-600 transition-all hover:bg-indigo-50"
                    >
                      <Info size={14} />
                      {t('Ver explicación', 'Azalpena ikusi')}
                    </button>
                  ) : (
                    <div className="rounded-[1.5rem] border border-slate-200 bg-indigo-50/30 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                          <Info size={16} />
                          {t('Explicación', 'Azalpena')}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExplanationOpen(false)}
                          className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-[0.2em] transition-colors"
                        >
                          {t('Cerrar', 'Itxi')}
                        </button>
                      </div>
                      <EditorialExplanation
                        text={selectedQuestion.explanation}
                        emptyLabel={t('Sin explicación disponible.', 'Ez dago azalpenik.')}
                      />
                    </div>
                  )}
              </div>
          ))}
        </div>
      </dialog>
    </div>
  );
}
