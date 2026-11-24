import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Edit3,
  FileText,
  Highlighter,
  Search,
  Trash2,
} from 'lucide-react';
import type { Question } from '../types';
import { useAppLocale } from '../lib/locale';
import {
  getAllUserStudyData,
  getCurriculumCategoryGroupLabel,
  saveStudyData,
} from '../lib/quantiaApi';
import { getQuestionsByIds } from '../lib/questionBankApi';
import HighlightableText, {
  type HighlightType,
  type TextHighlight,
} from './HighlightableText';
import QuestionNoteDrawer from './QuestionNoteDrawer';
import StudySubNav, { type StudySubView } from './StudySubNav';

export interface MyNotesAndHighlightsProps {
  curriculum: string;
  userId?: string | null;
  /** Opens a single annotated question (receives the question id). */
  onJumpToQuestion?: (questionId: string) => void;
  onOpenStudyBank?: () => void;
  /** Opens a hydrated question in study mode. */
  onStudyQuestion?: (question: Question) => void;
  onNavigateStudyTab?: (tab: StudySubView) => void;
}

type ScopeFilter = 'current' | 'all';
type KindFilter = 'all' | 'notes' | 'highlights';
type TypeFilter = 'all' | HighlightType;

interface ExtractedSnippet {
  id: string;
  key: string;
  type: HighlightType;
  text: string;
  sourceLabel: string;
}

const HIGHLIGHT_TYPE_META: Record<
  HighlightType,
  { es: string; eu: string; badgeClass: string }
> = {
  core_concept: {
    es: 'Clave',
    eu: 'Gakoa',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  law_reference: {
    es: 'Ley',
    eu: 'Legea',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  },
  deadline: {
    es: 'Plazo',
    eu: 'Epea',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  exception: {
    es: 'Excep.',
    eu: 'Salb.',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-900',
  },
  free: {
    es: 'Libre',
    eu: 'Librea',
    badgeClass: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  },
};

export default function MyNotesAndHighlights({
  curriculum,
  onJumpToQuestion,
  onOpenStudyBank,
  onStudyQuestion,
  onNavigateStudyTab,
}: MyNotesAndHighlightsProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = useCallback((es: string, eu: string) => (isBasque ? eu : es), [isBasque]);

  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const [highlightsMap, setHighlightsMap] = useState<Record<string, TextHighlight[]>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [questionsById, setQuestionsById] = useState<
    Record<string, Question & { curriculum?: string | null }>
  >({});

  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteQuestionId, setEditingNoteQuestionId] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const library = await getAllUserStudyData();
      setHighlightsMap(library.highlights);
      setNotesMap(library.notes);
      setQuestionIds(library.questionIds);
      setQuestionsById({});
      setLoading(false);
      // Hydrate question stems in the background: notes are usable even if the
      // question bank is slow or unreachable.
      if (library.questionIds.length > 0) {
        void getQuestionsByIds(library.questionIds)
          .then((hydrated) => {
            if (isMountedRef.current) setQuestionsById(hydrated);
          })
          .catch(() => {
            // Keep fallback cards without question stems
          });
      }
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const items = useMemo(() => {
    return questionIds
      .map((questionId) => {
        const question = questionsById[questionId] ?? null;
        const note = (notesMap[questionId] ?? '').trim();
        const stemHighlights = highlightsMap[questionId] ?? [];
        const expHighlights = highlightsMap[`${questionId}_exp`] ?? [];
        const answerHighlightsByIndex = [0, 1, 2, 3].map(
          (idx) => highlightsMap[`${questionId}_ans_${idx}`] ?? [],
        );

        const snippets: ExtractedSnippet[] = [];
        const stemText = question?.text ?? '';
        for (const hl of stemHighlights) {
          const slice = stemText
            ? stemText.slice(Math.max(0, hl.startIndex), Math.max(0, hl.endIndex)).trim()
            : '';
          snippets.push({
            id: hl.id,
            key: questionId,
            type: hl.type,
            text: slice || `#${hl.startIndex}-${hl.endIndex}`,
            sourceLabel: isBasque ? 'Enuntziatua' : 'Enunciado',
          });
        }

        question?.options.forEach((opt, idx) => {
          const list = answerHighlightsByIndex[idx] ?? [];
          for (const hl of list) {
            const slice = opt.text
              .slice(Math.max(0, hl.startIndex), Math.max(0, hl.endIndex))
              .trim();
            snippets.push({
              id: hl.id,
              key: `${questionId}_ans_${idx}`,
              type: hl.type,
              text: slice || opt.text,
              sourceLabel: `${isBasque ? 'Aukera' : 'Opción'} ${opt.id.toUpperCase()}`,
            });
          }
        });

        const expText = question?.explanation ?? '';
        for (const hl of expHighlights) {
          const slice = expText
            ? expText.slice(Math.max(0, hl.startIndex), Math.max(0, hl.endIndex)).trim()
            : '';
          snippets.push({
            id: hl.id,
            key: `${questionId}_exp`,
            type: hl.type,
            text: slice || `#${hl.startIndex}-${hl.endIndex}`,
            sourceLabel: isBasque ? 'Azalpena' : 'Explicación',
          });
        }

        const totalHighlights =
          stemHighlights.length +
          expHighlights.length +
          answerHighlightsByIndex.reduce((acc, list) => acc + list.length, 0);

        if (!note && totalHighlights === 0) return null;

        const topicLabel =
          (question?.category
            ? getCurriculumCategoryGroupLabel(curriculum, question.category) ?? question.category
            : null) ?? (isBasque ? 'Orokorra' : 'General');

        return {
          questionId,
          question,
          topicLabel,
          note,
          stemHighlights,
          snippets,
          totalHighlights,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [curriculum, highlightsMap, isBasque, notesMap, questionIds, questionsById]);

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.topicLabel) set.add(item.topicLabel);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedCurriculum = curriculum.trim().toLowerCase();

    return items.filter((item) => {
      if (scopeFilter === 'current' && item.question?.curriculum) {
        if (item.question.curriculum.trim().toLowerCase() !== normalizedCurriculum) {
          return false;
        }
      }
      if (kindFilter === 'notes' && !item.note) return false;
      if (kindFilter === 'highlights' && item.totalHighlights === 0) return false;
      if (typeFilter !== 'all') {
        const hasType =
          item.stemHighlights.some((h) => h.type === typeFilter) ||
          item.snippets.some((s) => s.type === typeFilter);
        if (!hasType) return false;
      }
      if (topicFilter !== 'all' && item.topicLabel !== topicFilter) return false;
      if (normalizedSearch) {
        const haystack = [
          item.question?.text ?? '',
          item.note,
          item.topicLabel,
          ...item.snippets.map((s) => s.text),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [curriculum, items, kindFilter, scopeFilter, searchQuery, topicFilter, typeFilter]);

  const handleSaveNote = async (questionId: string, nextNote: string) => {
    const trimmed = nextNote.trim();
    setNotesMap((prev) => {
      const next = { ...prev };
      if (trimmed) next[questionId] = nextNote;
      else delete next[questionId];
      return next;
    });
    await saveStudyData(questionId, { notes: trimmed ? nextNote : '' });
  };

  const handleRemoveStemHighlight = async (questionId: string, highlightId: string) => {
    const current = highlightsMap[questionId] ?? [];
    const nextList = current.filter((h) => h.id !== highlightId);
    setHighlightsMap((prev) => ({ ...prev, [questionId]: nextList }));
    await saveStudyData(questionId, { highlights: nextList }, { baseQuestionId: questionId });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            <Highlighter size={21} className="text-indigo-600" aria-hidden="true" />
            {t('Mis notas y subrayados', 'Nire oharrak eta azpimarrak')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'Consulta, filtra y edita todas tus anotaciones personales y fragmentos subrayados en tests y estudio.',
              'Kontsultatu, iragazi eta editatu testetan eta ikasketan egindako apunte eta azpimarra guztiak.',
            )}
          </p>
        </div>

        {onNavigateStudyTab ? (
          <StudySubNav activeTab="study-notes" onChangeTab={onNavigateStudyTab} />
        ) : null}
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={t('Filtrar por tipo de contenido', 'Eduki motaren arabera iragazi')}
              className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
            >
              {(
                [
                  { id: 'all', label: t('Todo', 'Dena') },
                  { id: 'notes', label: t('Con nota', 'Apunteekin') },
                  { id: 'highlights', label: t('Con subrayados', 'Azpimarrekin') },
                ] as Array<{ id: KindFilter; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={kindFilter === item.id}
                  onClick={() => setKindFilter(item.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    kindFilter === item.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label={t('Filtrar por categoría de subrayado', 'Azpimarra motaren arabera iragazi')}
              className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
            >
              <button
                type="button"
                aria-pressed={typeFilter === 'all'}
                onClick={() => setTypeFilter('all')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${
                  typeFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                {t('Todas las marcas', 'Marka guztiak')}
              </button>
              {(Object.keys(HIGHLIGHT_TYPE_META) as HighlightType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={typeFilter === type}
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${
                    typeFilter === type
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {isBasque ? HIGHLIGHT_TYPE_META[type].eu : HIGHLIGHT_TYPE_META[type].es}
                </button>
              ))}
            </div>
          </div>

          <div
            role="group"
            aria-label={t('Ámbito de oposición', 'Oposizio esparrua')}
            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
          >
            <button
              type="button"
              aria-pressed={scopeFilter === 'current'}
              onClick={() => setScopeFilter('current')}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                scopeFilter === 'current'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {t('Esta oposición', 'Oposizio hau')}
            </button>
            <button
              type="button"
              aria-pressed={scopeFilter === 'all'}
              onClick={() => setScopeFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                scopeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {t('Todas', 'Denak')}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t(
                'Buscar en tus notas, subrayados o enunciados...',
                'Bilatu zure apunteetan, azpimarretan edo galderetan...',
              )}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          {availableTopics.length > 1 ? (
            <select
              aria-label={t('Filtrar por tema', 'Gaiaren arabera iragazi')}
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-bold text-slate-700"
            >
              <option value="all">{t('Todos los temas', 'Gai guztiak')}</option>
              {availableTopics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-500">
          {t('Cargando tus notas y subrayados...', 'Kargatzen...')}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center space-y-2">
          <div className="text-base font-black text-slate-800">
            {items.length === 0
              ? t(
                  'Todavía no tienes notas ni subrayados guardados',
                  'Oraindik ez duzu ezer gordeta',
                )
              : t(
                  'Ninguna anotación coincide con este filtro',
                  'Ez dago iragazki honekin bat datorren emaitzarik',
                )}
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-md mx-auto">
            {t(
              'Selecciona cualquier fragmento mientras estudias o revisas un test para subrayarlo por colores o añadir tu nota personal.',
              'Hautatu edozein testu-zati ikasten edo test bat berrikusten ari zaren bitartean kolorez azpimarratzeko edo apuntea gehitzeko.',
            )}
          </p>
          {items.length === 0 && onOpenStudyBank ? (
            <button
              type="button"
              onClick={onOpenStudyBank}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
            >
              <BookOpen size={13} aria-hidden="true" />
              {t('Abrir banco de preguntas', 'Galdera-bankua ireki')}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isEditingNote = editingNoteQuestionId === item.questionId;
            return (
              <div
                key={item.questionId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.question?.number != null ? (
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
                        #{item.question.number}
                      </span>
                    ) : null}
                    <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                      {item.topicLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingNoteQuestionId(isEditingNote ? null : item.questionId)
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 size={13} />
                      {item.note
                        ? t('Editar nota', 'Oharra editatu')
                        : t('Añadir nota', 'Oharra gehitu')}
                    </button>
                    {item.question && onStudyQuestion ? (
                      <button
                        type="button"
                        onClick={() => onStudyQuestion(item.question!)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-indigo-700"
                      >
                        <BookOpen size={13} />
                        {t('Estudiar esta pregunta', 'Galdera hau ikasi')}
                      </button>
                    ) : onJumpToQuestion ? (
                      <button
                        type="button"
                        onClick={() => onJumpToQuestion(item.questionId)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-indigo-700"
                      >
                        <BookOpen size={13} />
                        {t('Ver pregunta', 'Galdera ikusi')}
                      </button>
                    ) : null}
                  </div>
                </div>

                {item.question ? (
                  <div className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                    <HighlightableText
                      text={item.question.text}
                      highlights={item.stemHighlights}
                      onAddHighlight={() => {}}
                      onRemoveHighlight={(id) =>
                        void handleRemoveStemHighlight(item.questionId, id)
                      }
                    />
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-500">
                    {t('Pregunta', 'Galdera')} #{item.questionId}
                  </div>
                )}

                {item.snippets.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      {t('Fragmentos subrayados', 'Azpimarratutako zatiak')} ({item.snippets.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.snippets.map((snippet) => {
                        const meta = HIGHLIGHT_TYPE_META[snippet.type];
                        return (
                          <div
                            key={`${snippet.key}:${snippet.id}`}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${meta.badgeClass}`}
                          >
                            <span className="font-black uppercase tracking-wider text-[10px]">
                              {isBasque ? meta.eu : meta.es} · {snippet.sourceLabel}:
                            </span>
                            <span>“{snippet.text}”</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {item.note && !isEditingNote ? (
                  <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs sm:text-sm text-amber-950">
                    <div className="flex items-start gap-2">
                      <FileText size={15} className="mt-0.5 shrink-0 text-amber-700" />
                      <div>
                        <span className="font-black text-amber-900">
                          {t('Nota personal: ', 'Ohar pertsonala: ')}
                        </span>
                        <span className="font-medium">{item.note}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveNote(item.questionId, '')}
                      aria-label={t('Borrar nota', 'Oharra ezabatu')}
                      className="shrink-0 rounded-lg p-1 text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}

                <QuestionNoteDrawer
                  open={isEditingNote}
                  questionId={item.questionId}
                  questionNumber={item.question?.number ?? null}
                  note={item.note}
                  onClose={() => setEditingNoteQuestionId(null)}
                  onSave={(nextNote) => handleSaveNote(item.questionId, nextNote)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
