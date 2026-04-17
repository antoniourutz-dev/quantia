import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Database, Loader2, Pencil, Plus, Save, Search, X } from 'lucide-react';
import type { AdminQuestionDetail, AdminQuestionListItem, OptionKey, PracticeQuestionScopeFilter, SyllabusType } from '../../types';
import { useAppLocale } from '../../lib/locale';
import type { CurriculumOption } from '../../lib/quantiaApi';
import {
  adminCreateQuestion,
  adminFindAdjacentQuestionId,
  adminGetQuestionDetail,
  adminListQuestions,
  adminResolveOppositionConfigByOppositionId,
  adminUpdateQuestion,
} from '../../lib/quantiaApi';

type EditorMode = 'create' | 'edit';

type Draft = {
  oppositionId: string;
  curriculum: string;
  curriculumKey: string;
  syllabus: SyllabusType;
  number: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: OptionKey;
  explanation: string;
  editorialExplanation: string;
  topic: string;
  lawReference: string;
  questionScopeKey: string;
  subjectKey: string;
  subjectId: string;
  scopeId: string;
  generalLawId: string;
  generalLawBlockId: string;
  generalLawQuestionType: string;
  dominantTrapType: string;
  languageCode: string;
  difficulty: string;
};

const emptyDraft = (curriculum: string): Draft => ({
  oppositionId: '',
  curriculum,
  curriculumKey: '',
  syllabus: 'common',
  number: '',
  text: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctAnswer: 'a',
  explanation: '',
  editorialExplanation: '',
  topic: '',
  lawReference: '',
  questionScopeKey: '',
  subjectKey: '',
  subjectId: '',
  scopeId: '',
  generalLawId: '',
  generalLawBlockId: '',
  generalLawQuestionType: '',
  dominantTrapType: '',
  languageCode: 'es',
  difficulty: '',
});

const toDraftFromDetail = (detail: AdminQuestionDetail): Draft => {
  const getOption = (key: OptionKey) => detail.options.find((opt) => opt.id === key)?.text ?? '';
  return {
    oppositionId: detail.oppositionId ?? '',
    curriculum: detail.curriculum ?? '',
    curriculumKey: detail.curriculumKey ?? '',
    syllabus: detail.syllabus,
    number: typeof detail.number === 'number' ? String(detail.number) : '',
    text: detail.text,
    optionA: getOption('a'),
    optionB: getOption('b'),
    optionC: getOption('c'),
    optionD: getOption('d'),
    correctAnswer: detail.correctAnswer ?? 'a',
    explanation: detail.explanation ?? '',
    editorialExplanation: detail.editorialExplanation ?? '',
    topic: detail.topic ?? '',
    lawReference: detail.lawReference ?? '',
    questionScopeKey: detail.questionScopeKey ?? '',
    subjectKey: detail.subjectKey ?? '',
    subjectId: detail.subjectId ?? '',
    scopeId: detail.scopeId ?? '',
    generalLawId: detail.generalLawId ?? '',
    generalLawBlockId: detail.generalLawBlockId ?? '',
    generalLawQuestionType: detail.generalLawQuestionType ?? '',
    dominantTrapType: detail.dominantTrapType ?? '',
    languageCode: detail.languageCode ?? 'es',
    difficulty: typeof detail.difficulty === 'number' ? String(detail.difficulty) : '',
  };
};

const normalizeNumberInput = (value: string) => value.replace(/[^\d]/g, '').slice(0, 6);

export default function AdminQuestions({
  curriculumOptions,
  defaultCurriculum,
  onClose,
}: {
  curriculumOptions: CurriculumOption[];
  defaultCurriculum: string;
  onClose: () => void;
}) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const [filterCurriculum, setFilterCurriculum] = useState<string>(defaultCurriculum);
  const [filterOppositionId, setFilterOppositionId] = useState<string>('');
  const [filterCurriculumKey, setFilterCurriculumKey] = useState<string>('');
  const [filterScope, setFilterScope] = useState<PracticeQuestionScopeFilter>('all');
  const [filterLanguageCode, setFilterLanguageCode] = useState<string>('');
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [lawReference, setLawReference] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [items, setItems] = useState<AdminQuestionListItem[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [navLoading, setNavLoading] = useState<'prev' | 'next' | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultCurriculum));
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const refreshSeqRef = useRef(0);
  const lastFilterCurriculumRef = useRef<string>(defaultCurriculum);
  const [executedKey, setExecutedKey] = useState<string | null>(null);
  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        filterCurriculum,
        filterOppositionId,
        filterCurriculumKey,
        filterScope,
        filterLanguageCode,
        search,
        topic,
        lawReference,
        pageSize,
      }),
    [
      filterCurriculum,
      filterOppositionId,
      filterCurriculumKey,
      filterScope,
      filterLanguageCode,
      search,
      topic,
      lawReference,
      pageSize,
    ],
  );

  useEffect(() => {
    const previous = lastFilterCurriculumRef.current;
    lastFilterCurriculumRef.current = filterCurriculum;
    if (editorMode !== 'create') return;
    if (!filterCurriculum) return;
    setDraft((prev) => ({
      ...prev,
      curriculum: prev.curriculum === previous || !prev.curriculum ? filterCurriculum : prev.curriculum,
    }));
  }, [filterCurriculum]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void (async () => {
        const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const oppositionId = draft.oppositionId.trim();
        if (!oppositionId || !uuidOk.test(oppositionId)) return;
        if (draft.curriculum.trim() && draft.curriculumKey.trim()) return;
        const resolved = await adminResolveOppositionConfigByOppositionId(oppositionId);
        if (resolved.curriculum && !draft.curriculum.trim()) {
          setDraft((prev) => ({ ...prev, curriculum: resolved.curriculum ?? prev.curriculum }));
        }
        if (resolved.curriculumKey && !draft.curriculumKey.trim()) {
          setDraft((prev) => ({ ...prev, curriculumKey: resolved.curriculumKey ?? prev.curriculumKey }));
        }
      })();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [draft.oppositionId]);

  const curriculumSelectOptions = useMemo(() => {
    const unique = new Map<string, CurriculumOption>();
    for (const opt of curriculumOptions) {
      if (!unique.has(opt.id)) unique.set(opt.id, opt);
    }
    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [curriculumOptions]);

  const refresh = async (nextPage = page) => {
    const seq = (refreshSeqRef.current += 1);
    setLoading(true);
    setNotice(null);
    try {
      const result = await adminListQuestions({
        curriculum: filterCurriculum.trim() || null,
        oppositionId: filterOppositionId.trim() || null,
        curriculumKey: filterCurriculumKey.trim() || null,
        questionScope: filterScope,
        search,
        topic,
        lawReference,
        languageCode: filterLanguageCode.trim() || null,
        page: nextPage,
        pageSize,
      });
      if (seq !== refreshSeqRef.current) return;
      setItems(result.items);
      setHasNextPage(result.hasNextPage);
      setPage(result.page);
    } catch (error) {
      if (seq !== refreshSeqRef.current) return;
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : t('No se han podido cargar las preguntas.', 'Ezin izan dira galderak kargatu.'),
      });
    } finally {
      if (seq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!executedKey) return;
    if (executedKey === filtersKey) return;
    setExecutedKey(null);
    setSelectedId(null);
    setItems([]);
    setHasNextPage(false);
    setPage(1);
  }, [executedKey, filtersKey]);

  const handleSearch = async () => {
    setSelectedId(null);
    setExecutedKey(filtersKey);
    await refresh(1);
  };

  const startCreate = () => {
    setEditorMode('create');
    setSelectedId(null);
    setDraft(emptyDraft(filterCurriculum.trim() || defaultCurriculum));
    setNotice(null);
  };

  const openQuestion = async (id: string) => {
    setSelectedId(id);
    setEditorMode('edit');
    setDetailLoading(true);
    setNotice(null);
    try {
      const loaded = await adminGetQuestionDetail(id);
      setDraft(toDraftFromDetail(loaded));
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : t('No se ha podido cargar la pregunta.', 'Ezin izan da galdera kargatu.'),
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const canNavigate = editorMode === 'edit' && Boolean(selectedId) && Boolean(draft.oppositionId.trim()) && Boolean(draft.number.trim());

  const navigate = async (direction: 'prev' | 'next') => {
    if (!canNavigate) return;
    if (navLoading) return;
    const fromNumber = Number(draft.number.trim());
    if (!Number.isFinite(fromNumber)) return;
    setNavLoading(direction);
    setNotice(null);
    try {
      const next = await adminFindAdjacentQuestionId({
        direction,
        oppositionId: draft.oppositionId.trim(),
        curriculum: draft.curriculum.trim() || null,
        curriculumKey: draft.curriculumKey.trim() || null,
        syllabus: draft.syllabus,
        fromNumber,
      });
      if (!next) {
        setNotice({
          kind: 'success',
          text: direction === 'next' ? t('No hay más preguntas.', 'Ez dago galdera gehiagorik.') : t('No hay anteriores.', 'Ez dago aurreko galderarik.'),
        });
        return;
      }
      await openQuestion(next.id);
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : t('No se ha podido navegar.', 'Ezin izan da nabigatu.'),
      });
    } finally {
      setNavLoading(null);
    }
  };

  const validateDraft = (value: Draft) => {
    const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!value.oppositionId.trim() || !uuidOk.test(value.oppositionId.trim())) {
      return t('opposition_id es obligatorio (UUID).', 'opposition_id derrigorrezkoa da (UUID).');
    }
    if (!value.curriculum.trim()) return t('El curriculum es obligatorio.', 'Curriculuma derrigorrezkoa da.');
    if (!value.text.trim()) return t('La pregunta es obligatoria.', 'Galdera derrigorrezkoa da.');
    if (!value.optionA.trim() || !value.optionB.trim()) return t('Las opciones A y B son obligatorias.', 'A eta B aukerak derrigorrezkoak dira.');
    if (value.correctAnswer === 'c' && !value.optionC.trim()) return t('La opción C es obligatoria.', 'C aukera derrigorrezkoa da.');
    if (value.correctAnswer === 'd' && !value.optionD.trim()) return t('La opción D es obligatoria.', 'D aukera derrigorrezkoa da.');
    if (!['a', 'b', 'c', 'd'].includes(value.correctAnswer)) {
      return t('La respuesta correcta es inválida.', 'Erantzun zuzena baliogabea da.');
    }
    if (value.generalLawId.trim()) {
      if (!uuidOk.test(value.generalLawId.trim())) return t('general_law_id inválido.', 'general_law_id baliogabea.');
      if (!value.generalLawBlockId.trim() || !uuidOk.test(value.generalLawBlockId.trim())) {
        return t('general_law_block_id es obligatorio (UUID).', 'general_law_block_id derrigorrezkoa da (UUID).');
      }
      if (!value.curriculumKey.trim()) return t('curriculum_key es obligatorio para leyes generales.', 'curriculum_key derrigorrezkoa da lege orokorretarako.');
    }
    return null;
  };

  const save = async () => {
    const validation = validateDraft(draft);
    if (validation) {
      setNotice({ kind: 'error', text: validation });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const numberValue = draft.number.trim() ? Number(draft.number.trim()) : null;
      const difficultyValue = draft.difficulty.trim() ? Number(draft.difficulty.trim()) : null;
      const payload = {
        oppositionId: draft.oppositionId.trim(),
        curriculum: draft.curriculum.trim(),
        curriculumKey: draft.curriculumKey.trim() || null,
        syllabus: draft.syllabus,
        number: Number.isFinite(numberValue ?? NaN) ? numberValue : null,
        text: draft.text.trim(),
        options: {
          a: draft.optionA.trim(),
          b: draft.optionB.trim(),
          c: draft.optionC.trim() || null,
          d: draft.optionD.trim() || null,
        },
        correctAnswer: draft.correctAnswer,
        explanation: draft.explanation.trim() || null,
        editorialExplanation: draft.editorialExplanation.trim() || null,
        topic: draft.topic.trim() || null,
        lawReference: draft.lawReference.trim() || null,
        questionScopeKey: draft.questionScopeKey.trim() || null,
        subjectKey: draft.subjectKey.trim() || null,
        subjectId: draft.subjectId.trim() || null,
        scopeId: draft.scopeId.trim() || null,
        generalLawId: draft.generalLawId.trim() || null,
        generalLawBlockId: draft.generalLawBlockId.trim() || null,
        generalLawQuestionType: draft.generalLawQuestionType.trim() || null,
        dominantTrapType: draft.dominantTrapType.trim() || null,
        languageCode: draft.languageCode.trim() || null,
        difficulty: Number.isFinite(difficultyValue ?? NaN) ? difficultyValue : null,
      };

      const result =
        editorMode === 'create'
          ? await adminCreateQuestion(payload)
          : selectedId
            ? await adminUpdateQuestion(selectedId, payload)
            : await adminCreateQuestion(payload);

      setSelectedId(result.id);
      setEditorMode('edit');
      setDraft(toDraftFromDetail(result));
      setNotice({ kind: 'success', text: t('Guardado.', 'Gordeta.') });
      if (executedKey) {
        await refresh(page);
      }
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : t('No se ha podido guardar.', 'Ezin izan da gorde.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-400">
            <Database size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('Gestión', 'Kudeaketa')}</span>
          </div>
          <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{t('Gestión de preguntas', 'Galderen kudeaketa')}</h2>
          <div className="mt-2 text-sm font-medium text-slate-500 leading-relaxed">
            {t('Crear y editar preguntas reales del banco.', 'Galdera-bankuko galderak sortu eta editatu.')}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Volver', 'Itzuli')}
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <Plus size={16} />
            {t('Nueva pregunta', 'Galdera berria')}
          </button>
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Buscar', 'Bilatu')}</div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder={t('Texto o número...', 'Testua edo zenbakia...')}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Oposición', 'Oposizioa')}</div>
            <select
              value={filterCurriculum}
              onChange={(e) => setFilterCurriculum(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
            >
              <option value="">{t('Todas', 'Guztiak')}</option>
              {curriculumSelectOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">opposition_id</div>
            <input
              value={filterOppositionId}
              onChange={(e) => setFilterOppositionId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="UUID (opcional)"
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Temario', 'Temarioa')}</div>
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value as PracticeQuestionScopeFilter)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
            >
              <option value="all">{t('Todos', 'Denak')}</option>
              <option value="common">{t('Común', 'Orokorra')}</option>
              <option value="specific">{t('Específico', 'Espezifikoa')}</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">curriculum_key</div>
            <input
              value={filterCurriculumKey}
              onChange={(e) => setFilterCurriculumKey(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              placeholder={t('Opcional', 'Aukerakoa')}
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Idioma', 'Hizkuntza')}</div>
            <select
              value={filterLanguageCode}
              onChange={(e) => setFilterLanguageCode(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
            >
              <option value="">{t('Todos', 'Denak')}</option>
              <option value="es">ES</option>
              <option value="eu">EU</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Tema/bloque', 'Gaia/blokea')}</div>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              placeholder={t('Opcional', 'Aukerakoa')}
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Ley ref.', 'Lege ref.')}</div>
            <input
              value={lawReference}
              onChange={(e) => setLawReference(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              placeholder={t('Opcional', 'Aukerakoa')}
            />
          </div>

          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleSearch}
              className="w-full md:w-auto rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
            >
              {t('Aplicar', 'Aplikatu')}
            </button>
          </div>
        </div>

        {notice ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
              notice.kind === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-rose-100 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">{notice.text}</div>
              {notice.kind === 'error' ? (
                <button
                  type="button"
                  onClick={handleSearch}
                  className="shrink-0 rounded-2xl bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-700 border border-slate-200"
                >
                  {t('Reintentar', 'Berriro saiatu')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {executedKey ? (
        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-100 flex-wrap">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {loading ? t('Cargando...', 'Kargatzen...') : `${t('Resultados', 'Emaitzak')}: ${items.length}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className="h-10 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-50"
              >
                {t('Prev', 'Aurrekoa')}
              </button>
              <div className="h-10 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 flex items-center">
                {page}
              </div>
              <button
                type="button"
                onClick={() => void refresh(page + 1)}
                disabled={!hasNextPage || loading}
                className="h-10 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-50"
              >
                {t('Next', 'Hurrengoa')}
              </button>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700"
              >
                {[25, 50, 100, 150].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openQuestion(item.id)}
                className={`w-full text-left px-6 py-5 hover:bg-slate-50 transition-all ${
                  selectedId === item.id ? 'bg-indigo-50/60' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      {item.curriculum ?? '—'} • {item.syllabus === 'common' ? t('Común', 'Orokorra') : t('Específico', 'Espezifikoa')}
                      {typeof item.number === 'number' ? ` • #${item.number}` : ''}
                    </div>
                    <div className="mt-2 text-sm font-black text-slate-900 leading-relaxed max-h-[3.25rem] overflow-hidden">{item.text}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex flex-wrap gap-2">
                      <span>
                        {t('Resp', 'Erantz')}: {item.correctAnswer ? item.correctAnswer.toUpperCase() : '—'}
                      </span>
                      {item.topic ? <span>{item.topic}</span> : null}
                      {item.lawReference ? <span>{item.lawReference}</span> : null}
                    </div>
                  </div>
                  <div className="shrink-0 h-10 w-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600">
                    <Pencil size={16} />
                  </div>
                </div>
              </button>
            ))}
            {items.length === 0 && !loading ? (
              <div className="px-6 py-10 text-slate-500 font-bold">{t('Sin resultados.', 'Emaitzarik ez.')}</div>
            ) : null}
            {loading ? (
              <div className="px-6 py-10 text-slate-500 flex items-center justify-center gap-3 font-bold">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('Cargando...', 'Kargatzen...')}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                {editorMode === 'create' ? t('Nueva pregunta', 'Galdera berria') : t('Edición', 'Edizioa')}
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 truncate">
                {editorMode === 'create' ? t('Crear', 'Sortu') : selectedId ? `#${selectedId}` : t('Editar', 'Editatu')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editorMode === 'edit' && selectedId ? (
                <>
                  <button
                    type="button"
                    onClick={() => void navigate('prev')}
                    disabled={!canNavigate || navLoading !== null}
                    className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-50"
                    title={t('Anterior', 'Aurrekoa')}
                  >
                    {navLoading === 'prev' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronLeft size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigate('next')}
                    disabled={!canNavigate || navLoading !== null}
                    className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-50"
                    title={t('Siguiente', 'Hurrengoa')}
                  >
                    {navLoading === 'next' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600"
                    title={t('Nueva', 'Berria')}
                  >
                    <Plus size={18} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setDraft(emptyDraft(filterCurriculum.trim() || defaultCurriculum));
                    setEditorMode('create');
                    setNotice(null);
                  }}
                  className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600"
                  title={t('Limpiar', 'Garbitu')}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {detailLoading ? (
            <div className="mt-8 text-slate-500 flex items-center justify-center gap-3 font-bold">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('Cargando...', 'Kargatzen...')}
            </div>
          ) : null}

          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('opposition_id', 'opposition_id')}</div>
                <input
                  value={draft.oppositionId}
                  onChange={(e) => setDraft((prev) => ({ ...prev, oppositionId: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Curriculum', 'Curriculuma')}</div>
                <select
                  value={draft.curriculum}
                  onChange={(e) => setDraft((prev) => ({ ...prev, curriculum: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                >
                  {curriculumSelectOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('curriculum_key', 'curriculum_key')}</div>
                <input
                  value={draft.curriculumKey}
                  onChange={(e) => setDraft((prev) => ({ ...prev, curriculumKey: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder={t('Opcional', 'Aukerakoa')}
                />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Temario', 'Temarioa')}</div>
                <select
                  value={draft.syllabus}
                  onChange={(e) => setDraft((prev) => ({ ...prev, syllabus: e.target.value as SyllabusType }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                >
                  <option value="common">{t('Común', 'Orokorra')}</option>
                  <option value="specific">{t('Específico', 'Espezifikoa')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Idioma', 'Hizkuntza')}</div>
                <select
                  value={draft.languageCode}
                  onChange={(e) => setDraft((prev) => ({ ...prev, languageCode: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                >
                  <option value="es">ES</option>
                  <option value="eu">EU</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Dificultad', 'Zailtasuna')}</div>
                <input
                  value={draft.difficulty}
                  onChange={(e) => setDraft((prev) => ({ ...prev, difficulty: normalizeNumberInput(e.target.value) }))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder={t('Opcional', 'Aukerakoa')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Número', 'Zenbakia')}</div>
                <input
                  value={draft.number}
                  onChange={(e) => setDraft((prev) => ({ ...prev, number: normalizeNumberInput(e.target.value) }))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder={t('Opcional', 'Aukerakoa')}
                />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Correcta', 'Zuzena')}</div>
                <select
                  value={draft.correctAnswer}
                  onChange={(e) => setDraft((prev) => ({ ...prev, correctAnswer: e.target.value as OptionKey }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                >
                  <option value="a">A</option>
                  <option value="b">B</option>
                  <option value="c">C</option>
                  <option value="d">D</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Pregunta', 'Galdera')}</div>
              <textarea
                value={draft.text}
                onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
                className="w-full min-h-[92px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>

            <div className="space-y-3">
              {([
                { key: 'A', value: draft.optionA, setter: (v: string) => setDraft((p) => ({ ...p, optionA: v })) },
                { key: 'B', value: draft.optionB, setter: (v: string) => setDraft((p) => ({ ...p, optionB: v })) },
                { key: 'C', value: draft.optionC, setter: (v: string) => setDraft((p) => ({ ...p, optionC: v })) },
                { key: 'D', value: draft.optionD, setter: (v: string) => setDraft((p) => ({ ...p, optionD: v })) },
              ] as const).map((opt) => (
                <div key={opt.key} className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center font-black text-slate-700">
                    {opt.key}
                  </div>
                  <input
                    value={opt.value}
                    onChange={(e) => opt.setter(e.target.value)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder={t('Texto opción', 'Aukeraren testua')}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Explicación', 'Azalpena')}</div>
              <textarea
                value={draft.explanation}
                onChange={(e) => setDraft((prev) => ({ ...prev, explanation: e.target.value }))}
                className="w-full min-h-[92px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Explicación editorial', 'Azalpen editoriala')}</div>
              <textarea
                value={draft.editorialExplanation}
                onChange={(e) => setDraft((prev) => ({ ...prev, editorialExplanation: e.target.value }))}
                className="w-full min-h-[72px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Tema/bloque', 'Gaia/blokea')}</div>
                <input
                  value={draft.topic}
                  onChange={(e) => setDraft((prev) => ({ ...prev, topic: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('subject_key', 'subject_key')}</div>
                <input
                  value={draft.subjectKey}
                  onChange={(e) => setDraft((prev) => ({ ...prev, subjectKey: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder={t('Opcional', 'Aukerakoa')}
                />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Ley ref.', 'Lege ref.')}</div>
                <input
                  value={draft.lawReference}
                  onChange={(e) => setDraft((prev) => ({ ...prev, lawReference: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className="w-full rounded-[2rem] border border-slate-200 bg-white px-6 py-4 text-slate-700 font-black text-base shadow-sm hover:bg-slate-50 transition-all"
            >
              {advancedOpen ? t('Ocultar metadatos avanzados', 'Ezkutatu metadatu aurreratuak') : t('Metadatos avanzados', 'Metadatu aurreratuak')}
            </button>

            {advancedOpen ? (
              <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">question_scope_key</div>
                    <input
                      value={draft.questionScopeKey}
                      onChange={(e) => setDraft((prev) => ({ ...prev, questionScopeKey: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
                      placeholder={t('Opcional', 'Aukerakoa')}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">dominant_trap_type</div>
                    <input
                      value={draft.dominantTrapType}
                      onChange={(e) => setDraft((prev) => ({ ...prev, dominantTrapType: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
                      placeholder={t('Opcional', 'Aukerakoa')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">subject_id</div>
                    <input
                      value={draft.subjectId}
                      onChange={(e) => setDraft((prev) => ({ ...prev, subjectId: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-400"
                      placeholder="UUID"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">scope_id</div>
                    <input
                      value={draft.scopeId}
                      onChange={(e) => setDraft((prev) => ({ ...prev, scopeId: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-400"
                      placeholder="UUID"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">general_law_id</div>
                    <input
                      value={draft.generalLawId}
                      onChange={(e) => setDraft((prev) => ({ ...prev, generalLawId: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-400"
                      placeholder="UUID"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">general_law_block_id</div>
                    <input
                      value={draft.generalLawBlockId}
                      onChange={(e) => setDraft((prev) => ({ ...prev, generalLawBlockId: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-400"
                      placeholder="UUID"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">general_law_question_type</div>
                  <input
                    value={draft.generalLawQuestionType}
                    onChange={(e) => setDraft((prev) => ({ ...prev, generalLawQuestionType: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
                    placeholder={t('Opcional', 'Aukerakoa')}
                  />
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={save}
              disabled={saving || detailLoading}
              className="w-full rounded-[2rem] bg-slate-900 px-6 py-5 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl disabled:bg-slate-300"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={18} />}
              {saving ? t('Guardando...', 'Gordetzen...') : t('Guardar', 'Gorde')}
            </button>
          </div>
        </div>
      </div>
  );
}
