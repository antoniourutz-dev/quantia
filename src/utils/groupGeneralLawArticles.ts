import type { GeneralLawArticle } from '../types/generalLawTraining';

export type ArticleGroup = {
  key: string;
  label: string;
  articles: GeneralLawArticle[];
  children?: ArticleGroup[];
  totalArticles: number;
  totalQuestions: number;
  selectedArticles: number;
};

const cleanLabel = (value: string | null | undefined, fallback: string) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return fallback;
  return trimmed;
};

const cleanKey = (parts: Array<string | null | undefined>) =>
  parts.map((part) => cleanLabel(part, 'sin-dato').toLowerCase().replace(/\s+/g, '-')).join(':');

const summarizeGroup = (group: Pick<ArticleGroup, 'articles' | 'children'>, selectedIds: Set<string>) => {
  const childArticles = group.children?.flatMap((child) => flattenArticles(child)) ?? [];
  const articles = [...group.articles, ...childArticles];
  return {
    totalArticles: articles.length,
    totalQuestions: articles.reduce((sum, article) => sum + (article.question_count ?? 0), 0),
    selectedArticles: articles.filter((article) => selectedIds.has(article.id)).length,
  };
};

export const flattenArticles = (group: ArticleGroup): GeneralLawArticle[] => [
  ...group.articles,
  ...(group.children?.flatMap((child) => flattenArticles(child)) ?? []),
];

const createLeafGroup = (
  key: string,
  label: string,
  articles: GeneralLawArticle[],
  selectedIds: Set<string>,
): ArticleGroup => ({
  key,
  label,
  articles,
  totalArticles: articles.length,
  totalQuestions: articles.reduce((sum, article) => sum + (article.question_count ?? 0), 0),
  selectedArticles: articles.filter((article) => selectedIds.has(article.id)).length,
});

export const groupGeneralLawArticles = (
  articles: GeneralLawArticle[],
  selectedArticleIds: string[] = [],
): ArticleGroup[] => {
  const selectedIds = new Set(selectedArticleIds);
  const titleMap = new Map<string, GeneralLawArticle[]>();

  for (const article of articles) {
    const titleLabel = cleanLabel(article.title_label, 'Sin título');
    const titleKey = cleanKey([article.title_key, titleLabel]);
    titleMap.set(titleKey, [...(titleMap.get(titleKey) ?? []), article]);
  }

  return Array.from(titleMap.entries()).map(([titleKey, titleArticles]) => {
    const titleLabel = cleanLabel(titleArticles[0]?.title_label, 'Sin título');
    const chapterMap = new Map<string, GeneralLawArticle[]>();

    for (const article of titleArticles) {
      const chapterLabel = cleanLabel(article.chapter_label, 'Sin capítulo');
      const chapterKey = cleanKey([titleKey, article.chapter_key, chapterLabel]);
      chapterMap.set(chapterKey, [...(chapterMap.get(chapterKey) ?? []), article]);
    }

    const chapters = Array.from(chapterMap.entries()).map(([chapterKey, chapterArticles]) => {
      const chapterLabel = cleanLabel(chapterArticles[0]?.chapter_label, 'Sin capítulo');
      const realSections = new Set(
        chapterArticles
          .map((article) => cleanLabel(article.section_label, ''))
          .filter(Boolean),
      );

      if (realSections.size <= 1) {
        return createLeafGroup(chapterKey, chapterLabel, chapterArticles, selectedIds);
      }

      const sectionMap = new Map<string, GeneralLawArticle[]>();
      for (const article of chapterArticles) {
        const sectionLabel = cleanLabel(article.section_label, 'Sin sección');
        const sectionKey = cleanKey([chapterKey, article.section_key, sectionLabel]);
        sectionMap.set(sectionKey, [...(sectionMap.get(sectionKey) ?? []), article]);
      }

      const sectionChildren = Array.from(sectionMap.entries()).map(([sectionKey, sectionArticles]) =>
        createLeafGroup(sectionKey, cleanLabel(sectionArticles[0]?.section_label, 'Sin sección'), sectionArticles, selectedIds),
      );
      const group: ArticleGroup = { key: chapterKey, label: chapterLabel, articles: [], children: sectionChildren, totalArticles: 0, totalQuestions: 0, selectedArticles: 0 };
      return { ...group, ...summarizeGroup(group, selectedIds) };
    });

    const group: ArticleGroup = { key: titleKey, label: titleLabel, articles: [], children: chapters, totalArticles: 0, totalQuestions: 0, selectedArticles: 0 };
    return { ...group, ...summarizeGroup(group, selectedIds) };
  });
};
