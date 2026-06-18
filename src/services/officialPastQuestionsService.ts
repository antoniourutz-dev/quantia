import {
  getOfficialPastQuestions,
  getOfficialQuestionArticleLinks,
} from '../repositories/officialPastQuestionsRepository';
import { officialQuestionToPracticeQuestion } from '../components/official-questions/OfficialQuestionPracticeAdapter';
import type {
  OfficialPastQuestion,
  OfficialPastQuestionArticleLink,
  OfficialQuestionFilters,
  OfficialQuestionSummary,
} from '../types/officialPastQuestions';

const sortOfficialQuestions = (questions: OfficialPastQuestion[]) =>
  [...questions].sort((left, right) => {
    const leftYear = left.source_year ?? 0;
    const rightYear = right.source_year ?? 0;
    if (leftYear !== rightYear) return leftYear - rightYear;
    const leftTheme = left.source_theme_number ?? 0;
    const rightTheme = right.source_theme_number ?? 0;
    if (leftTheme !== rightTheme) return leftTheme - rightTheme;
    return left.official_question_number - right.official_question_number;
  });

const dedupeOfficialQuestions = (questions: OfficialPastQuestion[]) => {
  const byId = new Map<string, OfficialPastQuestion>();
  for (const question of questions) byId.set(question.id, question);
  return Array.from(byId.values());
};

export const loadOfficialQuestionBank = async (filters: OfficialQuestionFilters = {}) => {
  const questions = sortOfficialQuestions(dedupeOfficialQuestions(await getOfficialPastQuestions(filters)));
  const links = await getOfficialQuestionArticleLinks(questions.map((question) => question.id));
  return { questions, links, summary: buildOfficialQuestionSummary(questions, links) };
};

export const loadOfficialQuestionPracticeSet = async (
  filters: OfficialQuestionFilters = {},
  limit: number | 'all' = 20,
  randomize = true,
) => {
  const { questions, links } = await loadOfficialQuestionBank(filters);
  const ordered = randomize ? shuffleQuestions(questions) : questions;
  const selected = limit === 'all' ? ordered : ordered.slice(0, Math.max(1, limit));
  const linksByQuestionId = new Map<string, OfficialPastQuestionArticleLink[]>();
  for (const link of links) {
    linksByQuestionId.set(link.official_question_id, [...(linksByQuestionId.get(link.official_question_id) ?? []), link]);
  }
  return {
    questions: selected.map((question) => officialQuestionToPracticeQuestion(question, linksByQuestionId.get(question.id) ?? [])),
    officialQuestions: selected,
    links,
  };
};

const shuffleQuestions = (questions: OfficialPastQuestion[]) => {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

export const countOfficialQuestions = async (filters: OfficialQuestionFilters = {}) => {
  const questions = await getOfficialPastQuestions(filters);
  return dedupeOfficialQuestions(questions).length;
};

const groupBy = (questions: OfficialPastQuestion[], getKey: (question: OfficialPastQuestion) => string) => {
  const groups = new Map<string, OfficialPastQuestion[]>();
  for (const question of questions) {
    const key = getKey(question);
    groups.set(key, [...(groups.get(key) ?? []), question]);
  }
  return groups;
};

export const groupOfficialQuestionsByLaw = (questions: OfficialPastQuestion[]) =>
  groupBy(questions, (question) => question.law_short_title ?? 'Sin ley');

export const groupOfficialQuestionsBySource = (questions: OfficialPastQuestion[]) =>
  groupBy(questions, (question) => `${question.source_institution} ${question.source_year ?? ''}`.trim());

export const buildOfficialQuestionSummary = (
  questions: OfficialPastQuestion[],
  links: OfficialPastQuestionArticleLink[] = [],
): OfficialQuestionSummary => ({
  totalQuestions: questions.length,
  sourceInstitutions: Array.from(new Set(questions.map((question) => question.source_institution))).sort(),
  sourceYears: Array.from(
    new Set(questions.map((question) => question.source_year).filter((year): year is number => typeof year === 'number')),
  ).sort((left, right) => left - right),
  lawLabels: Array.from(new Set(questions.map((question) => question.law_short_title ?? question.law_title).filter(Boolean) as string[])).sort(),
  articleCount: new Set(links.map((link) => link.article_id)).size,
});

export { officialQuestionToPracticeQuestion };
