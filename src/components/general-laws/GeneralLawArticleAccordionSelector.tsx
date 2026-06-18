import { useEffect, useMemo, useRef } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { useGeneralLawArticleSelection } from '../../hooks/useGeneralLawArticleSelection';
import { flattenArticles, groupGeneralLawArticles, type ArticleGroup } from '../../utils/groupGeneralLawArticles';
import type { GeneralLawArticle } from '../../types/generalLawTraining';

type AccordionCopy = {
  chooseArticles: string;
  loadingArticles: string;
  noArticles: string;
  selected: string;
  questions: string;
  selectAll: string;
  clear: string;
  rlsHint: string;
  expand: string;
  collapse: string;
  selectedSummary: (selected: number, total: number, questions: number) => string;
};

export default function GeneralLawArticleAccordionSelector({
  userId,
  generalLawId,
  articles,
  selectedArticleIds,
  loading,
  error,
  copy,
  onToggleArticle,
  onSelectAllArticles,
  onClearArticles,
  onSelectArticleGroup,
  onClearArticleGroup,
  officialArticleCounts = {},
}: {
  userId?: string | null;
  generalLawId?: string | null;
  articles: GeneralLawArticle[];
  selectedArticleIds: string[];
  loading: boolean;
  error: string | null;
  copy: AccordionCopy;
  onToggleArticle?: (articleId: string) => void;
  onSelectAllArticles?: () => void;
  onClearArticles?: () => void;
  onSelectArticleGroup?: (articleIds: string[]) => void;
  onClearArticleGroup?: (articleIds: string[]) => void;
  officialArticleCounts?: Record<string, number>;
}) {
  const groups = useMemo(() => groupGeneralLawArticles(articles, selectedArticleIds), [articles, selectedArticleIds]);
  const selectedQuestions = useMemo(
    () =>
      articles
        .filter((article) => selectedArticleIds.includes(article.id))
        .reduce((sum, article) => sum + (article.question_count ?? 0), 0),
    [articles, selectedArticleIds],
  );
  const articleSelection = useGeneralLawArticleSelection({
    userId,
    generalLawId,
    selectedArticleIds,
    groups,
    onSelectArticleIds: onSelectArticleGroup,
    onClearArticleIds: onClearArticleGroup,
    onSelectAll: onSelectAllArticles,
    onClearAll: onClearArticles,
  });

  return (
    <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{copy.chooseArticles}</div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            {loading
              ? copy.loadingArticles
              : copy.selectedSummary(selectedArticleIds.length, articles.length, selectedQuestions)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={articleSelection.selectAll}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-white"
          >
            {copy.selectAll}
          </button>
          <button
            type="button"
            onClick={articleSelection.clearAll}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-white"
          >
            {copy.clear}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {error}
          <div className="mt-1 text-xs text-amber-800">{copy.rlsHint}</div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {groups.map((group) => (
          <GeneralLawArticleGroupCard
            key={group.key}
            group={group}
            selectedArticleIds={selectedArticleIds}
            expanded={articleSelection.expandedGroupKeys.includes(group.key)}
            fullySelected={articleSelection.isGroupFullySelected(group.key)}
            partiallySelected={articleSelection.isGroupPartiallySelected(group.key)}
            copy={copy}
            onToggleGroup={() => articleSelection.toggleGroup(group.key)}
            onSelectGroup={() => articleSelection.selectGroup(group.key)}
            onClearGroup={() => articleSelection.clearGroup(group.key)}
            onToggleArticle={onToggleArticle}
            officialArticleCounts={officialArticleCounts}
          />
        ))}
      </div>

      {!loading && !error && articles.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {copy.noArticles}
        </div>
      ) : null}
    </div>
  );
}

function GeneralLawArticleGroupCard({
  group,
  selectedArticleIds,
  expanded,
  fullySelected,
  partiallySelected,
  copy,
  onToggleGroup,
  onSelectGroup,
  onClearGroup,
  onToggleArticle,
  officialArticleCounts,
}: {
  group: ArticleGroup;
  selectedArticleIds: string[];
  expanded: boolean;
  fullySelected: boolean;
  partiallySelected: boolean;
  copy: AccordionCopy;
  onToggleGroup: () => void;
  onSelectGroup: () => void;
  onClearGroup: () => void;
  onToggleArticle?: (articleId: string) => void;
  officialArticleCounts: Record<string, number>;
}) {
  const contentId = `general-law-article-group-${group.key.replace(/[^a-z0-9_-]/gi, '-')}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggleGroup}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 rounded-full bg-white p-1 text-slate-500 shadow-sm">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <GroupSelectionIndicator checked={fullySelected} indeterminate={partiallySelected} />
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-900">{group.label}</span>
            <span className="mt-1 block text-xs font-bold text-slate-500">
              {group.totalArticles} artículos · {group.totalQuestions} {copy.questions} · {group.selectedArticles} {copy.selected}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-wrap gap-2 pl-11 sm:pl-0">
          <button
            type="button"
            onClick={onSelectGroup}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:text-indigo-700"
          >
            {copy.selectAll}
          </button>
          <button
            type="button"
            onClick={onClearGroup}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:text-rose-700"
          >
            {copy.clear}
          </button>
        </div>
      </div>

      {expanded ? (
        <div id={contentId} className="space-y-3 border-t border-slate-100 bg-white px-3 py-3">
          {group.children?.map((child) => (
            <GeneralLawArticleSubgroup
              key={child.key}
              group={child}
              selectedArticleIds={selectedArticleIds}
              onToggleArticle={onToggleArticle}
              officialArticleCounts={officialArticleCounts}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function GeneralLawArticleSubgroup({
  group,
  selectedArticleIds,
  onToggleArticle,
  officialArticleCounts,
}: {
  group: ArticleGroup;
  selectedArticleIds: string[];
  onToggleArticle?: (articleId: string) => void;
  officialArticleCounts: Record<string, number>;
}) {
  const articles = flattenArticles(group);
  return (
    <section className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-black text-slate-700">{group.label}</div>
      {group.children?.length ? (
        <div className="mt-3 space-y-3">
          {group.children.map((child) => (
            <div key={child.key}>
              <div className="mb-2 text-[11px] font-bold text-slate-400">{child.label}</div>
              <ArticleGrid
                articles={child.articles}
                selectedArticleIds={selectedArticleIds}
                onToggleArticle={onToggleArticle}
                officialArticleCounts={officialArticleCounts}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <ArticleGrid
            articles={articles}
            selectedArticleIds={selectedArticleIds}
            onToggleArticle={onToggleArticle}
            officialArticleCounts={officialArticleCounts}
          />
        </div>
      )}
    </section>
  );
}

function ArticleGrid({
  articles,
  selectedArticleIds,
  onToggleArticle,
  officialArticleCounts,
}: {
  articles: GeneralLawArticle[];
  selectedArticleIds: string[];
  onToggleArticle?: (articleId: string) => void;
  officialArticleCounts: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {articles.map((article) => (
        <GeneralLawArticleItem
          key={article.id}
          article={article}
          selected={selectedArticleIds.includes(article.id)}
          onToggleArticle={onToggleArticle}
          officialCount={officialArticleCounts[article.id] ?? 0}
        />
      ))}
    </div>
  );
}

function GeneralLawArticleItem({
  article,
  selected,
  onToggleArticle,
  officialCount,
}: {
  article: GeneralLawArticle;
  selected: boolean;
  onToggleArticle?: (articleId: string) => void;
  officialCount: number;
}) {
  const questionCount = article.question_count ?? 0;
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition-all ${
        selected
          ? 'border-indigo-200 bg-indigo-50'
          : questionCount > 0
            ? 'border-slate-100 bg-white'
            : 'border-slate-100 bg-slate-50 opacity-60'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleArticle?.(article.id)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-800">
          Art. {article.article_number}
          {article.article_title ? ` - ${article.article_title}` : ''}
        </span>
        <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {questionCount} editoriales · {officialCount} oficiales
        </span>
      </span>
    </label>
  );
}

function GroupSelectionIndicator({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      readOnly
      tabIndex={-1}
      checked={checked}
      aria-hidden="true"
      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
    />
  );
}
