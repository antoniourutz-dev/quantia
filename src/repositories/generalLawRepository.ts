import { supabase } from '../lib/supabaseClient';
import { readText } from '../lib/quantiaMappers';
import type {
  GeneralLawArticle,
  GeneralLawArticleQuestionCountParams,
  GeneralLawArticleQuestionCounts,
} from '../types/generalLawTraining';

type ArticleQuestionLink = {
  articleId: string;
  questionId: string;
  relevance: string | null;
};

const mapRepositoryError = (error: { message?: string | null }) =>
  error.message || 'No se ha podido completar la consulta normativa.';

const readNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapGeneralLawArticle = (row: Record<string, unknown>): GeneralLawArticle | null => {
  const id = readText(row.id);
  const lawId = readText(row.law_id);
  const articleNumber = readText(row.article_number);
  if (!id || !lawId || !articleNumber) return null;

  return {
    id,
    law_id: lawId,
    article_number: articleNumber,
    article_sort: readNumber(row.article_sort),
    article_title: readText(row.article_title) ?? null,
    title_key: readText(row.title_key) ?? null,
    title_label: readText(row.title_label) ?? null,
    chapter_key: readText(row.chapter_key) ?? null,
    chapter_label: readText(row.chapter_label) ?? null,
    section_key: readText(row.section_key) ?? null,
    section_label: readText(row.section_label) ?? null,
    status: readText(row.status) ?? 'published',
  };
};

const mapArticleQuestionLink = (row: Record<string, unknown>): ArticleQuestionLink | null => {
  const articleId = readText(row.article_id);
  const questionId = readText(row.question_id);
  if (!articleId || !questionId) return null;
  return {
    articleId,
    questionId,
    relevance: readText(row.relevance) ?? null,
  };
};

export const getPublishedGeneralLawArticles = async (lawId: string): Promise<GeneralLawArticle[]> => {
  const normalizedLawId = readText(lawId);
  if (!normalizedLawId) return [];

  const { data, error } = await supabase
    .schema('app')
    .from('general_law_articles')
    .select(
      'id,law_id,article_number,article_sort,article_title,title_key,title_label,chapter_key,chapter_label,section_key,section_label,status',
    )
    .eq('law_id', normalizedLawId)
    .eq('status', 'published')
    .order('article_sort', { ascending: true })
    .order('article_number', { ascending: true });

  if (error) {
    throw new Error(mapRepositoryError(error));
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(mapGeneralLawArticle)
    .filter((article): article is GeneralLawArticle => Boolean(article));
};

export const getQuestionIdsByGeneralLawArticles = async (articleIds: string[]): Promise<string[]> => {
  const normalizedArticleIds = Array.from(
    new Set(articleIds.map((articleId) => readText(articleId)).filter(Boolean) as string[]),
  );
  if (normalizedArticleIds.length === 0) return [];

  const { data, error } = await supabase
    .schema('app')
    .from('question_law_articles')
    .select('question_id')
    .in('article_id', normalizedArticleIds)
    .limit(10000);

  if (error) {
    throw new Error(mapRepositoryError(error));
  }

  return Array.from(
    new Set(
      ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => readText(row.question_id))
        .filter((questionId): questionId is string => Boolean(questionId)),
    ),
  );
};

export const getGeneralLawArticleQuestionCounts = async (
  params: GeneralLawArticleQuestionCountParams,
): Promise<Map<string, GeneralLawArticleQuestionCounts>> => {
  const lawId = readText(params.lawId);
  if (!lawId) return new Map();

  const articles = await getPublishedGeneralLawArticles(lawId);
  const articleIds = articles.map((article) => article.id);
  if (articleIds.length === 0) return new Map();

  const { data: linkRows, error: linkError } = await supabase
    .schema('app')
    .from('question_law_articles')
    .select('article_id,question_id,relevance')
    .in('article_id', articleIds)
    .limit(10000);

  if (linkError) {
    throw new Error(mapRepositoryError(linkError));
  }

  const links = ((linkRows ?? []) as Array<Record<string, unknown>>)
    .map(mapArticleQuestionLink)
    .filter((link): link is ArticleQuestionLink => Boolean(link));
  const questionIds = Array.from(new Set(links.map((link) => link.questionId)));
  if (questionIds.length === 0) return new Map();

  const questionQuery = supabase
    .from('preguntas')
    .select('id')
    .eq('opposition_id', params.oppositionId)
    .eq('curriculum', params.curriculum)
    .eq('curriculum_key', params.curriculumKey ?? params.curriculum)
    .eq('grupo', params.grupo ?? 'especifico')
    .eq('question_scope_key', params.questionScopeKey === 'common' ? 'common' : 'specific')
    .eq('general_law_id', lawId)
    .in('id', questionIds)
    .limit(10000);

  const { data: questionRows, error: questionError } = await questionQuery;
  if (questionError) {
    throw new Error(mapRepositoryError(questionError));
  }

  const validQuestionIds = new Set(
    ((questionRows ?? []) as Array<Record<string, unknown>>)
      .map((row) => readText(row.id))
      .filter((questionId): questionId is string => Boolean(questionId)),
  );
  const counts = new Map<string, GeneralLawArticleQuestionCounts>();

  for (const link of links) {
    if (!validQuestionIds.has(link.questionId)) continue;
    const current = counts.get(link.articleId) ?? { questionCount: 0, primaryQuestionCount: 0 };
    current.questionCount += 1;
    const relevance = String(link.relevance ?? '').trim().toLowerCase();
    if (relevance === 'primary' || relevance === 'principal') {
      current.primaryQuestionCount += 1;
    }
    counts.set(link.articleId, current);
  }

  return counts;
};
