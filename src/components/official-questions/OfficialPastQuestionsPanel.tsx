import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GeneralLaw, GeneralLawBlock, Question } from '../../types';
import type { OfficialQuestionFilters } from '../../types/officialPastQuestions';
import { loadOfficialQuestionBank, loadOfficialQuestionPracticeSet } from '../../services/officialPastQuestionsService';

type QuestionCountOption = 5 | 10 | 15 | 20 | 'all';
type OrderMode = 'random' | 'official';

const buildStorageKey = (userId: string | null | undefined, generalLawId: string | null | undefined) =>
  `officialPracticeConfig:${String(userId ?? 'anonymous').trim() || 'anonymous'}:${generalLawId || 'all'}`;

export default function OfficialPastQuestionsPanel({
  userId = null,
  activeLaw,
  laws = [],
  blocks,
  selectedArticleIds,
  onStartPractice,
}: {
  userId?: string | null;
  activeLaw: GeneralLaw | null;
  laws?: GeneralLaw[];
  blocks: GeneralLawBlock[];
  selectedArticleIds: string[];
  onStartPractice?: (questions: Question[], title: string) => void;
}) {
  const [lawId, setLawId] = useState(activeLaw?.id ?? '');
  const [sourceInstitution, setSourceInstitution] = useState('');
  const [sourceYear, setSourceYear] = useState('');
  const [sourceThemeNumber, setSourceThemeNumber] = useState('');
  const [blockId, setBlockId] = useState('');
  const [questionCount, setQuestionCount] = useState<QuestionCountOption>(10);
  const [orderMode, setOrderMode] = useState<OrderMode>('random');
  const [onlyWithExplanation, setOnlyWithExplanation] = useState(false);
  const [availableCount, setAvailableCount] = useState(0);
  const [summary, setSummary] = useState({ sources: 0, years: 0, articles: 0, laws: 0 });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageKey = useMemo(() => buildStorageKey(userId, activeLaw?.id ?? lawId), [activeLaw?.id, lawId, userId]);

  useEffect(() => {
    setLawId((current) => current || activeLaw?.id || '');
  }, [activeLaw?.id]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<{
        lawId: string;
        sourceInstitution: string;
        sourceYear: number | null;
        sourceThemeNumber: number | null;
        blockId: string;
        questionCount: QuestionCountOption;
        orderMode: OrderMode;
        onlyWithExplanation: boolean;
      }> | null;
      if (!parsed) return;
      setLawId(parsed.lawId ?? activeLaw?.id ?? '');
      setSourceInstitution(parsed.sourceInstitution ?? '');
      setSourceYear(parsed.sourceYear ? String(parsed.sourceYear) : '');
      setSourceThemeNumber(parsed.sourceThemeNumber ? String(parsed.sourceThemeNumber) : '');
      setBlockId(parsed.blockId ?? '');
      setQuestionCount(parsed.questionCount ?? 10);
      setOrderMode(parsed.orderMode ?? 'random');
      setOnlyWithExplanation(Boolean(parsed.onlyWithExplanation));
    } catch {
      // ignore invalid persisted config
    }
  }, [activeLaw?.id, storageKey]);

  const filters = useMemo<OfficialQuestionFilters>(
    () => ({
      lawId: lawId || activeLaw?.id || null,
      sourceInstitution: sourceInstitution || null,
      sourceYear: sourceYear ? Number(sourceYear) : null,
      sourceThemeNumber: sourceThemeNumber ? Number(sourceThemeNumber) : null,
      blockId: blockId || null,
      articleIds: selectedArticleIds.length > 0 ? selectedArticleIds : undefined,
      onlyWithExplanation,
    }),
    [activeLaw?.id, blockId, lawId, onlyWithExplanation, selectedArticleIds, sourceInstitution, sourceThemeNumber, sourceYear],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          lawId: filters.lawId,
          sourceInstitution,
          sourceYear: filters.sourceYear,
          sourceThemeNumber: filters.sourceThemeNumber,
          blockId,
          selectedArticleIds,
          questionCount,
          orderMode,
          onlyWithExplanation,
        }),
      );
    } catch {
      // optional persistence
    }
  }, [blockId, filters, onlyWithExplanation, orderMode, questionCount, selectedArticleIds, sourceInstitution, storageKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadOfficialQuestionBank(filters)
      .then((result) => {
        if (cancelled) return;
        setAvailableCount(result.questions.length);
        setSummary({
          sources: result.summary.sourceInstitutions.length,
          years: result.summary.sourceYears.length,
          articles: result.summary.articleCount,
          laws: result.summary.lawLabels.length,
        });
      })
      .catch((caught) => {
        if (cancelled) return;
        setAvailableCount(0);
        setSummary({ sources: 0, years: 0, articles: 0, laws: 0 });
        setError(caught instanceof Error ? caught.message : 'No se han podido cargar las preguntas oficiales.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const configuredCount = questionCount === 'all' ? availableCount : Math.min(questionCount, availableCount);
  const disabled = availableCount === 0 || configuredCount === 0;
  const activeLawLabel = laws.find((law) => law.id === filters.lawId)?.shortTitle ?? activeLaw?.shortTitle ?? activeLaw?.title ?? 'Todas las leyes';
  const configLine = [
    `${configuredCount || 0} preguntas ${orderMode === 'random' ? 'aleatorias' : 'en orden oficial'}`,
    activeLawLabel,
    filters.sourceThemeNumber ? `Tema ${filters.sourceThemeNumber}` : null,
    selectedArticleIds.length > 0 ? 'Artículos seleccionados' : null,
  ].filter(Boolean).join(' · ');

  const handleGenerate = async () => {
    if (disabled) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await loadOfficialQuestionPracticeSet(filters, questionCount, orderMode === 'random');
      if (result.questions.length === 0) {
        setError('No hay preguntas oficiales disponibles con esta selección.');
        return;
      }
      onStartPractice?.(result.questions, `Test oficial · ${activeLawLabel}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido generar el test oficial.');
    } finally {
      setGenerating(false);
    }
  };

  const clearFilters = () => {
    setLawId(activeLaw?.id ?? '');
    setSourceInstitution('');
    setSourceYear('');
    setSourceThemeNumber('');
    setBlockId('');
    setQuestionCount(10);
    setOrderMode('random');
    setOnlyWithExplanation(false);
  };

  return (
    <section className="rounded-[1.35rem] border border-slate-100 bg-white p-4">
      <div className="rounded-[1.5rem] bg-slate-950 px-5 py-5 text-white">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Preguntas oficiales</div>
        <h3 className="mt-2 text-2xl font-black">Preguntas oficiales / pasadas</h3>
        <p className="mt-2 max-w-2xl text-sm font-bold text-slate-300">
          Genera test aleatorios con preguntas reales de baterías oficiales, separadas del banco editorial propio.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SummaryPill label="Disponibles" value={loading ? '...' : String(availableCount)} />
        <SummaryPill label="Fuentes" value={String(summary.sources)} />
        <SummaryPill label="Años" value={String(summary.years)} />
        <SummaryPill label="Artículos" value={String(summary.articles)} />
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-950">Configura tu test oficial</h4>
            <p className="mt-1 text-sm font-bold text-slate-500">Test configurado: {configLine}</p>
          </div>
          <button
            type="button"
            disabled={disabled || generating}
            onClick={() => void handleGenerate()}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm disabled:bg-slate-300"
          >
            {generating ? 'Generando...' : 'Generar test oficial'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Ley" value={lawId} onChange={setLawId}>
            <option value="">Todas las leyes disponibles</option>
            {laws.map((law) => (
              <option key={law.id} value={law.id}>
                {law.shortTitle ?? law.title}
              </option>
            ))}
          </SelectField>
          <FilterInput label="Fuente" value={sourceInstitution} onChange={setSourceInstitution} />
          <FilterInput label="Año" value={sourceYear} onChange={setSourceYear} inputMode="numeric" />
          <FilterInput label="Tema oficial" value={sourceThemeNumber} onChange={setSourceThemeNumber} inputMode="numeric" />
          <SelectField label="Bloque" value={blockId} onChange={setBlockId}>
            <option value="">Todos</option>
            {blocks.map((block) => (
              <option key={block.id} value={block.id}>
                {block.title}
              </option>
            ))}
          </SelectField>
          <SelectField label="Número de preguntas" value={String(questionCount)} onChange={(value) => setQuestionCount(value === 'all' ? 'all' : Number(value) as QuestionCountOption)}>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
            <option value="all">Todas las disponibles</option>
          </SelectField>
          <SelectField label="Orden" value={orderMode} onChange={(value) => setOrderMode(value === 'official' ? 'official' : 'random')}>
            <option value="random">Aleatorio</option>
            <option value="official">Orden oficial</option>
          </SelectField>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={onlyWithExplanation}
              onChange={(event) => setOnlyWithExplanation(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Solo con explicación editorial
          </label>
        </div>

        {selectedArticleIds.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
            Filtro activo por {selectedArticleIds.length} artículos seleccionados.
          </div>
        ) : null}
      </div>

      {availableCount === 0 && !loading ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-800">
          No hay preguntas oficiales disponibles con esta selección.
          <button type="button" onClick={clearFilters} className="ml-3 text-indigo-700 underline">
            Limpiar filtros
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={clearFilters} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600">
          Limpiar filtros
        </button>
        <button type="button" disabled className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-300">
          Ver banco oficial
        </button>
      </div>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: 'numeric';
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none"
      />
    </label>
  );
}
