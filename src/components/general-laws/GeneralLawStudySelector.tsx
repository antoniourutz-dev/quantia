import type { GeneralLaw, GeneralLawBlock } from '../../types';
import type {
  GeneralLawArticle,
  GeneralLawSelectionMode,
  GeneralLawTrainingSelection,
} from '../../types/generalLawTraining';
import GeneralLawBlockAccordionSelector from './GeneralLawBlockAccordionSelector';
import GeneralLawArticleAccordionSelector from './GeneralLawArticleAccordionSelector';
import type { Question } from '../../types';
import OfficialPastQuestionsPanel from '../official-questions/OfficialPastQuestionsPanel';

type SelectorCopy = {
  law: string;
  blocks: string;
  articles: string;
  official: string;
  scope: string;
  comingSoon: string;
  selectAll: string;
  clear: string;
  onlyThis: string;
  loadingBlocks: string;
  loadingArticles: string;
  noBlocks: string;
  noArticles: string;
  selected: string;
  questions: string;
  chooseBlocks: string;
  chooseArticles: string;
  rlsHint: string;
  selectedSummary: (items: number, questions: number) => string;
};

const copy = (isBasque: boolean): SelectorCopy =>
  isBasque
    ? {
        law: 'Legea',
        blocks: 'Blokeak',
        articles: 'Artikuluak',
        official: 'Ofizialak',
        scope: 'Deialdia',
        comingSoon: 'Laster',
        selectAll: 'Denak',
        clear: 'Garbitu',
        onlyThis: 'Hau bakarrik',
        loadingBlocks: 'Blokeak kargatzen...',
        loadingArticles: 'Artikuluak kargatzen...',
        noBlocks: 'Ez dago argitaratutako blokerik lege honetarako.',
        noArticles: 'Ez dago argitaratutako artikulurik lege honetarako.',
        selected: 'hautatuta',
        questions: 'galdera',
        chooseBlocks: 'Entrenatu nahi dituzun blokeak',
        chooseArticles: 'Entrenatu nahi dituzun artikuluak',
        rlsHint: 'Berrikusi irakurketa-baimenak edo sortu ikuspegi publiko seguru bat.',
        selectedSummary: (items, questions) => `${items} elementu hautatuta · ${questions} galdera erabilgarri`,
      }
    : {
        law: 'Ley',
        blocks: 'Por bloques',
        articles: 'Por artículos',
        official: 'Oficiales',
        scope: 'Por convocatoria',
        comingSoon: 'Próximamente',
        selectAll: 'Seleccionar todos',
        clear: 'Limpiar',
        onlyThis: 'Solo este bloque',
        loadingBlocks: 'Cargando bloques...',
        loadingArticles: 'Cargando artículos...',
        noBlocks: 'No hay bloques publicados para esta ley.',
        noArticles: 'No hay artículos publicados para esta ley.',
        selected: 'seleccionados',
        questions: 'preguntas',
        chooseBlocks: 'Elige los bloques que quieres entrenar',
        chooseArticles: 'Elige los artículos que quieres entrenar',
        rlsHint: 'Revisa permisos SELECT o crea una vista pública segura de solo lectura.',
        selectedSummary: (items, questions) => `${items} seleccionados · ${questions} preguntas disponibles`,
      };

type GeneralLawStudySelectorProps = {
  laws: GeneralLaw[];
  activeLaw: GeneralLaw | null;
  onSelectLaw?: (lawId: string) => void;
  userId?: string | null;
  blocks: GeneralLawBlock[];
  articles: GeneralLawArticle[];
  officialArticleCounts?: Record<string, number>;
  selection: GeneralLawTrainingSelection | null;
  blocksLoading?: boolean;
  articlesLoading?: boolean;
  selectionError?: string | null;
  articlesError?: string | null;
  isBasque?: boolean;
  compact?: boolean;
  onSetMode?: (mode: GeneralLawSelectionMode) => void;
  onToggleBlock?: (blockId: string) => void;
  onSelectOnlyBlock?: (blockId: string) => void;
  onSelectAllBlocks?: () => void;
  onClearBlocks?: () => void;
  onSelectBlockGroup?: (blockIds: string[]) => void;
  onClearBlockGroup?: (blockIds: string[]) => void;
  onToggleArticle?: (articleId: string) => void;
  onSelectAllArticles?: () => void;
  onClearArticles?: () => void;
  onSelectArticleGroup?: (articleIds: string[]) => void;
  onClearArticleGroup?: (articleIds: string[]) => void;
  onStartOfficialPractice?: (questions: Question[], title: string) => void;
};

export default function GeneralLawStudySelector({
  laws,
  activeLaw,
  onSelectLaw,
  userId = null,
  blocks,
  articles,
  officialArticleCounts = {},
  selection,
  blocksLoading = false,
  articlesLoading = false,
  selectionError = null,
  articlesError = null,
  isBasque = false,
  compact = false,
  onSetMode,
  onToggleBlock,
  onSelectAllBlocks,
  onClearBlocks,
  onSelectBlockGroup,
  onClearBlockGroup,
  onToggleArticle,
  onSelectAllArticles,
  onClearArticles,
  onSelectArticleGroup,
  onClearArticleGroup,
  onStartOfficialPractice,
}: GeneralLawStudySelectorProps) {
  const c = copy(isBasque);
  const mode = selection?.mode ?? 'blocks';
  const selectedBlockIds = selection?.selectedBlockIds ?? [];
  const selectedArticleIds = selection?.selectedArticleIds ?? [];
  const selectedQuestions =
    mode === 'articles'
      ? articles
          .filter((article) => selectedArticleIds.includes(article.id))
          .reduce((sum, article) => sum + (article.question_count ?? 0), 0)
      : blocks
          .filter((block) => selectedBlockIds.includes(block.id))
          .reduce((sum, block) => sum + (block.questionCount ?? 0), 0);
  const selectedItemCount = mode === 'articles' ? selectedArticleIds.length : selectedBlockIds.length;

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{c.law}</div>
          {laws.length > 1 ? (
            <select
              value={activeLaw?.id ?? ''}
              onChange={(event) => onSelectLaw?.(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white lg:min-w-80"
            >
              {laws.map((law) => (
                <option key={law.id} value={law.id}>
                  {law.shortTitle ?? law.title}
                </option>
              ))}
            </select>
          ) : activeLaw ? (
            <div className="mt-1 text-sm font-black text-slate-900">{activeLaw.shortTitle ?? activeLaw.title}</div>
          ) : null}
          <div className="mt-2 text-xs font-bold text-slate-500">
            {c.selectedSummary(selectedItemCount, selectedQuestions)}
          </div>
        </div>

        <GeneralLawSelectionModeTabs mode={mode} copy={c} onSetMode={onSetMode} />
      </div>

      {selectionError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {selectionError}
        </div>
      ) : null}

      {mode === 'blocks' ? (
        <GeneralLawBlockAccordionSelector
          userId={userId}
          generalLawId={activeLaw?.id ?? selection?.generalLawId ?? null}
          blocks={blocks}
          articles={articles}
          selectedBlockIds={selectedBlockIds}
          loading={blocksLoading}
          copy={{
            chooseBlocks: c.chooseBlocks,
            loadingBlocks: c.loadingBlocks,
            noBlocks: c.noBlocks,
            selected: c.selected,
            questions: c.questions,
            selectAll: c.selectAll,
            clear: c.clear,
            pending: isBasque ? 'Edukirik gabe' : 'Pendiente de contenido',
            selectedSummary: (selected, total, questions) =>
              isBasque
                ? `${selected}/${total} bloke hautatuta · ${questions} galdera erabilgarri`
                : `${selected}/${total} bloques seleccionados · ${questions} preguntas disponibles`,
          }}
          onToggleBlock={onToggleBlock}
          onSelectAllBlocks={onSelectAllBlocks}
          onClearBlocks={onClearBlocks}
          onSelectBlockGroup={onSelectBlockGroup}
          onClearBlockGroup={onClearBlockGroup}
        />
      ) : mode === 'articles' ? (
        <GeneralLawArticleAccordionSelector
          userId={userId}
          generalLawId={activeLaw?.id ?? selection?.generalLawId ?? null}
          articles={articles}
          selectedArticleIds={selectedArticleIds}
          loading={articlesLoading}
          error={articlesError}
          copy={{
            chooseArticles: c.chooseArticles,
            loadingArticles: c.loadingArticles,
            noArticles: c.noArticles,
            selected: c.selected,
            questions: c.questions,
            selectAll: c.selectAll,
            clear: c.clear,
            rlsHint: c.rlsHint,
            expand: isBasque ? 'Zabaldu' : 'Desplegar',
            collapse: isBasque ? 'Tolestu' : 'Plegar',
            selectedSummary: (selected, total, questions) =>
              isBasque
                ? `${selected}/${total} artikulu hautatuta · ${questions} galdera erabilgarri`
                : `${selected}/${total} artículos seleccionados · ${questions} preguntas disponibles`,
          }}
          onToggleArticle={onToggleArticle}
          onSelectAllArticles={onSelectAllArticles}
          onClearArticles={onClearArticles}
          onSelectArticleGroup={onSelectArticleGroup}
          onClearArticleGroup={onClearArticleGroup}
          officialArticleCounts={officialArticleCounts}
        />
      ) : mode === 'official' ? (
        <OfficialPastQuestionsPanel
          userId={userId}
          activeLaw={activeLaw}
          laws={laws}
          blocks={blocks}
          selectedArticleIds={selectedArticleIds}
          onStartPractice={onStartOfficialPractice}
        />
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">
          {c.scope} · {c.comingSoon}
        </div>
      )}
    </div>
  );
}

export function GeneralLawSelectionModeTabs({
  mode,
  copy: c,
  onSetMode,
}: {
  mode: GeneralLawSelectionMode;
  copy: SelectorCopy;
  onSetMode?: (mode: GeneralLawSelectionMode) => void;
}) {
  const tabs: Array<{ mode: GeneralLawSelectionMode; label: string; disabled?: boolean }> = [
    { mode: 'blocks', label: c.blocks },
    { mode: 'articles', label: c.articles },
    { mode: 'official', label: c.official },
    { mode: 'scope', label: c.scope, disabled: true },
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          disabled={tab.disabled}
          onClick={() => onSetMode?.(tab.mode)}
          className={`rounded-xl px-3 py-2 text-[11px] font-black transition-all ${
            mode === tab.mode
              ? 'bg-white text-indigo-700 shadow-sm'
              : tab.disabled
                ? 'cursor-not-allowed text-slate-300'
                : 'text-slate-500 hover:bg-white'
          }`}
        >
          {tab.label}
          {tab.disabled ? <span className="ml-2 text-[9px] uppercase tracking-[0.14em]">{c.comingSoon}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function GeneralLawBlockSelector({
  blocks,
  selectedBlockIds,
  loading,
  copy: c,
  onToggleBlock,
  onSelectOnlyBlock,
  onSelectAllBlocks,
  onClearBlocks,
}: {
  blocks: GeneralLawBlock[];
  selectedBlockIds: string[];
  loading: boolean;
  copy: SelectorCopy;
  onToggleBlock?: (blockId: string) => void;
  onSelectOnlyBlock?: (blockId: string) => void;
  onSelectAllBlocks?: () => void;
  onClearBlocks?: () => void;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4">
      <SelectorHeader
        title={c.chooseBlocks}
        subtitle={loading ? c.loadingBlocks : `${selectedBlockIds.length}/${blocks.length} ${c.selected}`}
        copy={c}
        onSelectAll={onSelectAllBlocks}
        onClear={onClearBlocks}
      />

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {blocks.map((block) => {
          const selected = selectedBlockIds.includes(block.id);
          return (
            <div
              key={block.id}
              className={`rounded-2xl border px-3 py-3 transition-all ${
                selected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleBlock?.(block.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-800">{block.title}</span>
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {block.blockKey ?? block.id}
                    {typeof block.questionCount === 'number' ? ` · ${block.questionCount} ${c.questions}` : ''}
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => onSelectOnlyBlock?.(block.id)}
                className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 hover:text-indigo-800"
              >
                {c.onlyThis}
              </button>
            </div>
          );
        })}
      </div>

      {!loading && blocks.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {c.noBlocks}
        </div>
      ) : null}
    </div>
  );
}

function SelectorHeader({
  title,
  subtitle,
  copy: c,
  onSelectAll,
  onClear,
}: {
  title: string;
  subtitle: string;
  copy: SelectorCopy;
  onSelectAll?: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{title}</div>
        <div className="mt-1 text-xs font-bold text-slate-500">{subtitle}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-white"
        >
          {c.selectAll}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-white"
        >
          {c.clear}
        </button>
      </div>
    </div>
  );
}
