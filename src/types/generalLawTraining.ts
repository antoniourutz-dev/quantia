export interface GeneralLawArticle {
  id: string;
  law_id: string;
  article_number: string;
  article_sort: number;
  article_title: string | null;
  title_key: string | null;
  title_label: string | null;
  chapter_key: string | null;
  chapter_label: string | null;
  section_key: string | null;
  section_label: string | null;
  status: string;
  question_count?: number;
  primary_question_count?: number;
}

export type GeneralLawSelectionMode = 'blocks' | 'articles' | 'official' | 'scope';

export interface GeneralLawTrainingSelection {
  mode: GeneralLawSelectionMode;
  generalLawId: string;
  selectedBlockIds: string[];
  selectedArticleIds: string[];
  selectedScopeId?: string | null;
}

export interface PracticeFilters {
  oppositionId?: string | null;
  curriculum?: string | null;
  curriculumKey?: string | null;
  grupo?: string | null;
  questionScopeKey?: 'common' | 'specific' | 'mixed' | null;
  generalLawId?: string | null;
  generalLawBlockIds?: string[] | null;
  generalLawArticleIds?: string[] | null;
  generalLawScopeId?: string | null;
}

export interface GeneralLawArticleQuestionCountParams {
  lawId: string;
  oppositionId: string;
  curriculum: string;
  curriculumKey?: string | null;
  grupo?: string | null;
  questionScopeKey?: 'common' | 'specific' | 'mixed' | null;
}

export interface GeneralLawArticleQuestionCounts {
  questionCount: number;
  primaryQuestionCount: number;
}
