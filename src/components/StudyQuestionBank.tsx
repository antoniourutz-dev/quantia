import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, CheckCircle2, Info, Search } from 'lucide-react';
import { formatSyllabusLabel, type PracticeQuestionScopeFilter, type Question, type QuestionBankListItem } from '../types';
import { isSingleScopeCurriculum, useAppLocale } from '../lib/locale';
import { getCurriculumCategoryGroupLabel, getQuestionBankPage, getQuestionBankQuestionDetail } from '../lib/quantiaApi';

type StudyScope = PracticeQuestionScopeFilter;

const PAGE_SIZE = 60;

const toAnswerLabel = (value: QuestionBankListItem['correctAnswer']) => value.toUpperCase();

const formatScopeLabel = (scope: StudyScope, locale: 'es' | 'eu', curriculum: string) => {
  if (scope === 'all') return locale === 'eu' ? 'Denak' : 'Todos';
  return formatSyllabusLabel(scope, locale, { curriculum, variant: 'compact' });
};

export default function StudyQuestionBank({
  curriculum,
  onBack,
}: {
  curriculum: string;
  onBack?: (() => void) | null;
}) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);
  const initialScope = isSingleScopeCurriculum(curriculum) ? 'specific' : 'common';

  const [scope, setScope] = useState<StudyScope>(initialScope);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageItems, setPageItems] = useState<QuestionBankListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);

  const deferredSearchInput = useDeferredValue(searchInput);
  const searchTerm = deferredSearchInput.trim();
  const searchKey = searchTerm.toLowerCase();
  const detailCacheRef = useRef(new Map<string, Question>());

  const listErrorMessage = t(
    'No se han podido cargar las preguntas.',
    'Ezin izan dira galderak kargatu.',
  );
  const detailErrorMessage = t(
    'No se ha podido cargar la pregunta seleccionada.',
    'Ezin izan da hautatutako galdera kargatu.',
  );

  const scopeLabels = useMemo<StudyScope[]>(
    () => (isSingleScopeCurriculum(curriculum) ? ['specific'] : ['common', 'specific']),
    [curriculum],
  );

  useEffect(() => {
    if (scopeLabels.includes(scope)) return;
    setScope(scopeLabels[0]);
  }, [scope, scopeLabels]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedId(null);
    setSelectedQuestion(null);
    setExplanationOpen(false);
    setPageItems([]);
    setHasNextPage(false);
    setError(null);
  }, [curriculum, scope, searchKey]);

  useEffect(() => {
    let cancelled = false;

    setListLoading(true);
    setError(null);

    getQuestionBankPage({
      curriculum,
      questionScope: scope,
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: searchTerm,
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
  }, [curriculum, listErrorMessage, pageIndex, scope, searchTerm]);

  useEffect(() => {
    if (pageItems.length === 0) {
      setSelectedId(null);
      setExplanationOpen(false);
      return;
    }

    if (selectedId && pageItems.some((item) => item.id === selectedId)) {
      return;
    }

    setSelectedId(pageItems[0].id);
    setExplanationOpen(false);
  }, [pageItems, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedQuestion(null);
      setDetailLoading(false);
      setExplanationOpen(false);
      return;
    }

    const cached = detailCacheRef.current.get(selectedId);
    if (cached) {
      setSelectedQuestion(cached);
      setDetailLoading(false);
      setExplanationOpen(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
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
        setError(err instanceof Error ? err.message : detailErrorMessage);
        setSelectedQuestion(null);
      })
      .finally(() => {
        if (cancelled) return;
        setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [curriculum, detailErrorMessage, scope, selectedId]);

  const questionCountLabel = useMemo(() => {
    if (listLoading) return t('Cargando...', 'Kargatzen...');
    if (searchKey) {
      return `${t('Resultados', 'Emaitzak')}: ${pageItems.length}${hasNextPage ? '+' : ''}`;
    }
    return `${t('Página', 'Orria')} ${pageIndex + 1}`;
  }, [hasNextPage, listLoading, pageIndex, pageItems.length, searchKey, t]);

  const paginationHint = useMemo(() => {
    if (listLoading) return t('Cargando página...', 'Orria kargatzen...');
    if (pageItems.length === 0) return null;

    const from = pageIndex * PAGE_SIZE + 1;
    const to = from + pageItems.length - 1;

    return `${t('Página', 'Orria')} ${pageIndex + 1} · ${from}-${to} · ${PAGE_SIZE} ${t('preguntas por página', 'galdera orriko')} · ${
      hasNextPage ? t('Hay más páginas', 'Orrialde gehiago daude') : t('Última página', 'Azken orria')
    }`;
  }, [hasNextPage, listLoading, pageIndex, pageItems.length, t]);

  const getDisplayNumber = (question: QuestionBankListItem, indexInPage: number) => {
    if (typeof question.number === 'number' && Number.isFinite(question.number)) return question.number;
    return pageIndex * PAGE_SIZE + indexInPage + 1;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 text-slate-400">
            <BookOpen size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('Banco de preguntas', 'Galdera-bankua')}</span>
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            {t('Todas las preguntas, con respuesta y explicación', 'Galdera guztiak, erantzuna eta azalpenarekin')}
          </h2>
          <p className="mt-2 text-slate-500 text-lg font-medium">
            {t('Elige temario común o específico y abre cualquier pregunta.', 'Aukeratu orokorra edo espezifikoa eta ireki edozein galdera.')}
          </p>
        </div>

        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('Volver a Estudio', 'Ikasketara itzuli')}
          </button>
        ) : null}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-4 sm:p-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {t('Temario', 'Temarioa')}
            </div>
            <div className="flex flex-wrap gap-2">
              {scopeLabels.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`px-5 py-3 rounded-2xl border-2 font-black text-xs transition-all ${
                    scope === value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-100'
                  }`}
                >
                  {formatScopeLabel(value, locale, curriculum)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full sm:w-[320px] rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder={t('Buscar por número o texto...', 'Zenbakiz edo testuz bilatu...')}
              />
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                  disabled={pageIndex === 0}
                  className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-600">
                  {pageIndex + 1}
                </div>
                <button
                  type="button"
                  onClick={() => setPageIndex((prev) => prev + 1)}
                  disabled={!hasNextPage}
                  className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              {paginationHint ? (
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-left sm:text-right">
                  {paginationHint}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-bold">
            {error}
          </div>
        ) : null}

        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">
              {questionCountLabel}
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-4 sm:p-5">
              {listLoading ? (
                <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500 font-bold">
                  {t('Cargando preguntas...', 'Galderak kargatzen...')}
                </div>
              ) : pageItems.length === 0 ? (
                <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500 font-bold leading-relaxed">
                  {t(
                    'No hay preguntas disponibles con este filtro. Prueba cambiando de temario o ajustando la búsqueda.',
                    'Ez dago galderarik iragazki honekin. Saiatu temarioa aldatzen edo bilaketa doitzen.',
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] sm:grid-cols-[repeat(10,minmax(0,1fr))] md:grid-cols-[repeat(12,minmax(0,1fr))] lg:grid-cols-[repeat(18,minmax(0,1fr))] xl:grid-cols-[repeat(20,minmax(0,1fr))] gap-2.5 sm:gap-1.5">
                  {pageItems.map((question, index) => {
                    const isSelected = selectedId === question.id;
                    const displayNumber = getDisplayNumber(question, index);

                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(question.id);
                          setExplanationOpen(false);
                        }}
                        className={`relative aspect-square min-h-12 rounded-2xl border bg-white shadow-sm transition-all ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-50 shadow-indigo-200/30'
                            : 'border-slate-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-200/20'
                        }`}
                      >
                        <div className="absolute left-2 top-2 text-[10px] font-black leading-none text-slate-400">
                          {displayNumber}
                        </div>
                        <div className="flex h-full items-center justify-center">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[13px] font-black leading-none text-slate-900">
                            {toAnswerLabel(question.correctAnswer)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">
              {t('Detalle de la pregunta', 'Galderaren xehetasuna')}
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-4 sm:p-6">
              {!selectedId ? (
                <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500 font-bold">
                  {t('Selecciona una pregunta para verla.', 'Hautatu galdera bat ikusteko.')}
                </div>
              ) : detailLoading || !selectedQuestion ? (
                <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500 font-bold">
                  {t('Cargando detalle de la pregunta...', 'Galderaren xehetasuna kargatzen...')}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {t('Pregunta', 'Galdera')} {selectedQuestion.number ?? '—'}
                      </div>
                      <h2 className="mt-2 text-[15px] font-extrabold leading-[1.35] text-slate-800 sm:text-lg max-h-[35vh] overflow-y-auto pr-1">
                        {selectedQuestion.text}
                      </h2>
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
                    const isCorrect = option.id === selectedQuestion.correctAnswer;

                    return (
                      <div
                        key={option.id}
                        className={`relative flex items-start gap-4 p-4 sm:p-5 ${
                          isCorrect ? 'bg-emerald-50/60' : 'bg-white'
                        }`}
                      >
                        <div
                          className={`mt-0.5 h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center font-black ${
                            isCorrect
                              ? 'border-emerald-200 bg-white text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {option.id.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 text-sm sm:text-base font-bold leading-snug text-slate-700">
                          {option.text}
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
                      <div className="text-slate-600 leading-relaxed font-medium text-sm whitespace-pre-line">
                        {selectedQuestion.explanation || t('Sin explicación disponible.', 'Ez dago azalpenik.')}
                      </div>
                    </div>
                  )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
