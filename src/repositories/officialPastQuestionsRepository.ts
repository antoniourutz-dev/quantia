import { supabase } from '../lib/supabaseClient';
import { readText } from '../lib/quantiaMappers';
import type {
  OfficialAnswerKey,
  OfficialPastQuestion,
  OfficialPastQuestionArticleLink,
  OfficialQuestionFilters,
} from '../types/officialPastQuestions';

const readNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readAnswer = (value: unknown): OfficialAnswerKey | null => {
  const normalized = readText(value)?.toLowerCase();
  return normalized === 'a' || normalized === 'b' || normalized === 'c' || normalized === 'd' ? normalized : null;
};

const mapOfficialPastQuestion = (row: Record<string, unknown>): OfficialPastQuestion | null => {
  const id = readText(row.id);
  const sourceId = readText(row.source_id);
  const sourceInstitution = readText(row.source_institution);
  const sourceTitle = readText(row.source_title);
  const officialQuestionNumber = readNumber(row.official_question_number);
  const questionText = readText(row.question_text);
  const officialAnswer = readAnswer(row.official_answer);
  if (!id || !sourceId || !sourceInstitution || !sourceTitle || !officialQuestionNumber || !questionText || !officialAnswer) {
    return null;
  }

  return {
    id,
    source_id: sourceId,
    source_institution: sourceInstitution,
    source_title: sourceTitle,
    source_year: readNumber(row.source_year),
    source_body: readText(row.source_body) ?? null,
    source_process: readText(row.source_process) ?? null,
    license_label: readText(row.license_label) ?? null,
    source_theme_number: readNumber(row.source_theme_number),
    source_theme_title: readText(row.source_theme_title) ?? null,
    official_question_number: officialQuestionNumber,
    question_text: questionText,
    option_a: readText(row.option_a) ?? '',
    option_b: readText(row.option_b) ?? '',
    option_c: readText(row.option_c) ?? '',
    option_d: readText(row.option_d) ?? '',
    official_answer: officialAnswer,
    normalized_answer: readAnswer(row.normalized_answer),
    explanation_editorial: readText(row.explanation_editorial) ?? null,
    general_law_id: readText(row.general_law_id) ?? null,
    law_key: readText(row.law_key) ?? null,
    law_title: readText(row.law_title) ?? null,
    law_short_title: readText(row.law_short_title) ?? null,
    general_law_block_id: readText(row.general_law_block_id) ?? null,
    block_key: readText(row.block_key) ?? null,
    block_title: readText(row.block_title) ?? null,
    curriculum: readText(row.curriculum) ?? '',
    curriculum_key: readText(row.curriculum_key) ?? '',
    question_scope_key: (readText(row.question_scope_key) as OfficialPastQuestion['question_scope_key']) ?? 'specific',
    general_law_question_type: readText(row.general_law_question_type) ?? null,
    dominant_trap_type: readText(row.dominant_trap_type) ?? null,
    difficulty: readNumber(row.difficulty),
    language_code: readText(row.language_code) ?? 'es',
    source_page: readNumber(row.source_page),
    source_position: readText(row.source_position) ?? null,
    status: readText(row.status) ?? '',
    review_status: readText(row.review_status) ?? '',
    created_at: readText(row.created_at) ?? '',
    updated_at: readText(row.updated_at) ?? '',
  };
};

const mapOfficialArticleLink = (row: Record<string, unknown>): OfficialPastQuestionArticleLink | null => {
  const id = readText(row.id);
  const officialQuestionId = readText(row.official_question_id);
  const articleId = readText(row.article_id);
  if (!id || !officialQuestionId || !articleId) return null;
  const relevance = readText(row.relevance);
  return {
    id,
    official_question_id: officialQuestionId,
    law_id: readText(row.law_id) ?? '',
    law_key: readText(row.law_key) ?? '',
    law_short_title: readText(row.law_short_title) ?? '',
    article_id: articleId,
    article_number: readText(row.article_number) ?? '',
    article_sort: readNumber(row.article_sort) ?? 0,
    article_title: readText(row.article_title) ?? '',
    title_label: readText(row.title_label) ?? null,
    chapter_label: readText(row.chapter_label) ?? null,
    section_label: readText(row.section_label) ?? null,
    relevance: relevance === 'secondary' || relevance === 'context' ? relevance : 'primary',
    created_at: readText(row.created_at) ?? '',
  };
};

const getOfficialQuestionIdsByArticles = async (articleIds: string[]) => {
  const ids = Array.from(new Set(articleIds.map((id) => readText(id)).filter(Boolean) as string[]));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('public_official_past_question_law_articles')
    .select('official_question_id')
    .in('article_id', ids)
    .limit(10000);
  if (error) throw new Error(error.message);
  return Array.from(
    new Set(
      ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => readText(row.official_question_id))
        .filter((id): id is string => Boolean(id)),
    ),
  );
};

export const getOfficialPastQuestions = async (
  filters: OfficialQuestionFilters = {},
): Promise<OfficialPastQuestion[]> => {
  const articleQuestionIds = filters.articleIds?.length
    ? await getOfficialQuestionIdsByArticles(filters.articleIds)
    : null;
  if (articleQuestionIds && articleQuestionIds.length === 0) return [];

  let query = supabase
    .from('public_official_past_questions')
    .select('*')
    .order('source_year', { ascending: true })
    .order('source_theme_number', { ascending: true })
    .order('official_question_number', { ascending: true })
    .limit(1000);

  if (filters.lawId) query = query.eq('general_law_id', filters.lawId);
  if (filters.sourceInstitution) query = query.eq('source_institution', filters.sourceInstitution);
  if (typeof filters.sourceYear === 'number') query = query.eq('source_year', filters.sourceYear);
  if (typeof filters.sourceThemeNumber === 'number') query = query.eq('source_theme_number', filters.sourceThemeNumber);
  if (filters.blockId) query = query.eq('general_law_block_id', filters.blockId);
  if (typeof filters.difficulty === 'number') query = query.eq('difficulty', filters.difficulty);
  if (filters.onlyWithExplanation) query = query.not('explanation_editorial', 'is', null);
  if (articleQuestionIds?.length) query = query.in('id', articleQuestionIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(mapOfficialPastQuestion)
    .filter((question): question is OfficialPastQuestion => Boolean(question));
};

export const getOfficialQuestionArticleLinks = async (
  questionIds: string[],
): Promise<OfficialPastQuestionArticleLink[]> => {
  const ids = Array.from(new Set(questionIds.map((id) => readText(id)).filter(Boolean) as string[]));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('public_official_past_question_law_articles')
    .select('*')
    .in('official_question_id', ids)
    .order('article_sort', { ascending: true })
    .limit(10000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(mapOfficialArticleLink)
    .filter((link): link is OfficialPastQuestionArticleLink => Boolean(link));
};

export const getOfficialArticleCounts = async (lawId: string): Promise<Record<string, number>> => {
  const normalizedLawId = readText(lawId);
  if (!normalizedLawId) return {};
  const { data, error } = await supabase
    .from('public_official_past_question_article_counts')
    .select('article_id,official_total_questions')
    .eq('law_id', normalizedLawId)
    .limit(1000);
  if (error) return {};
  return Object.fromEntries(
    ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => [readText(row.article_id), readNumber(row.official_total_questions) ?? 0] as const)
      .filter((entry): entry is readonly [string, number] => Boolean(entry[0])),
  );
};
