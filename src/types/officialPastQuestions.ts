export type OfficialAnswerKey = 'a' | 'b' | 'c' | 'd';

export interface OfficialPastQuestion {
  id: string;
  source_id: string;
  source_institution: string;
  source_title: string;
  source_year: number | null;
  source_body: string | null;
  source_process: string | null;
  license_label: string | null;
  source_theme_number: number | null;
  source_theme_title: string | null;
  official_question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  official_answer: OfficialAnswerKey;
  normalized_answer?: OfficialAnswerKey | null;
  explanation_editorial: string | null;
  general_law_id: string | null;
  law_key: string | null;
  law_title: string | null;
  law_short_title: string | null;
  general_law_block_id: string | null;
  block_key: string | null;
  block_title: string | null;
  curriculum: string;
  curriculum_key: string;
  question_scope_key: 'common' | 'specific' | 'mixed';
  general_law_question_type: string | null;
  dominant_trap_type: string | null;
  difficulty: number | null;
  language_code: string;
  source_page: number | null;
  source_position: string | null;
  status: string;
  review_status: string;
  created_at: string;
  updated_at: string;
}

export interface OfficialPastQuestionArticleLink {
  id: string;
  official_question_id: string;
  law_id: string;
  law_key: string;
  law_short_title: string;
  article_id: string;
  article_number: string;
  article_sort: number;
  article_title: string;
  title_label: string | null;
  chapter_label: string | null;
  section_label: string | null;
  relevance: 'primary' | 'secondary' | 'context';
  created_at: string;
}

export interface OfficialQuestionFilters {
  lawId?: string | null;
  sourceInstitution?: string | null;
  sourceYear?: number | null;
  sourceThemeNumber?: number | null;
  blockId?: string | null;
  articleIds?: string[];
  onlyWithExplanation?: boolean;
  difficulty?: number | null;
}

export interface OfficialQuestionSummary {
  totalQuestions: number;
  sourceInstitutions: string[];
  sourceYears: number[];
  lawLabels: string[];
  articleCount: number;
}
