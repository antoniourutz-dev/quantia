export type StudyDocumentKind = 'manual' | 'repaso' | 'cuaderno' | 'soluciones' | 'errores';

export type StudyStatus = 'draft' | 'published' | 'retired';

export interface StudyDocumentVersionMeta {
  id: string;
  version: string;
  versionDate: string | null;
  status: StudyStatus;
  wordCount: number;
  normativeNote: string | null;
  sourcesNote: string | null;
}

export interface StudyDocumentSummary {
  id: string;
  kind: StudyDocumentKind;
  title: string;
  sortOrder: number;
  /** Version shown to this viewer: the published one, or the newest draft for reviewers. */
  current: StudyDocumentVersionMeta | null;
}

export interface StudyTopicSummary {
  id: string;
  code: string;
  topicNumber: number;
  title: string;
  status: StudyStatus;
  documents: StudyDocumentSummary[];
}

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
export type AnnotationKind = 'highlight' | 'note' | 'bookmark';

/** A character range inside one rendered block (`data-b`), in the block's own text. */
export interface AnnotationSpan {
  b: string;
  s: number;
  e: number;
}

export interface StudyAnnotation {
  id: string;
  documentId: string;
  versionId: string;
  kind: AnnotationKind;
  color: AnnotationColor | null;
  spans: AnnotationSpan[];
  anchorBlock: string | null;
  quote: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyProgress {
  documentId: string;
  versionId: string;
  progress: number;
  lastBlock: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export const DOCUMENT_KIND_ORDER: StudyDocumentKind[] = ['manual', 'repaso', 'cuaderno', 'soluciones', 'errores'];

export const DOCUMENT_KIND_LABEL: Record<StudyDocumentKind, string> = {
  manual: 'Manual',
  repaso: 'Repaso exprés',
  cuaderno: 'Cuaderno',
  soluciones: 'Solucionario',
  errores: 'Errores típicos',
};
