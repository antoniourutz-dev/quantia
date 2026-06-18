import type { OptionKey, Question } from '../../types';
import type { OfficialPastQuestion, OfficialPastQuestionArticleLink } from '../../types/officialPastQuestions';

export const officialQuestionToPracticeQuestion = (
  question: OfficialPastQuestion,
  articleLinks: OfficialPastQuestionArticleLink[] = [],
): Question => ({
  id: question.id,
  number: question.official_question_number,
  text: question.question_text,
  options: [
    { id: 'a', text: question.option_a },
    { id: 'b', text: question.option_b },
    { id: 'c', text: question.option_c },
    { id: 'd', text: question.option_d },
  ],
  correctAnswer: (question.normalized_answer ?? question.official_answer) as OptionKey,
  explanation: question.explanation_editorial ?? 'Pregunta oficial pendiente de explicación editorial.',
  syllabus: question.question_scope_key === 'common' ? 'common' : 'specific',
  category: [
    'OFICIAL',
    question.source_institution,
    question.source_year,
    question.source_theme_number ? `Tema ${question.source_theme_number}` : null,
    question.law_short_title,
  ]
    .filter(Boolean)
    .join(' · '),
  questionScope: question.question_scope_key === 'common' ? 'common' : 'specific',
  generalLawId: question.general_law_id,
  generalLawBlockId: question.general_law_block_id,
  practiceSource: 'official',
  officialMetadata: {
    sourceInstitution: question.source_institution,
    sourceYear: question.source_year,
    sourceBody: question.source_body,
    sourceThemeNumber: question.source_theme_number,
    officialQuestionNumber: question.official_question_number,
    lawShortTitle: question.law_short_title,
    blockTitle: question.block_title,
    licenseLabel: question.license_label,
    sourceTitle: question.source_title,
    articleLabels: articleLinks.map((link) => `Art. ${link.article_number}`),
  },
});
