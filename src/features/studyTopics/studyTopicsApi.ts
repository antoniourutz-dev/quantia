import { supabase } from '../../lib/supabaseClient';
import type {
  AnnotationColor,
  AnnotationKind,
  AnnotationSpan,
  StudyAnnotation,
  StudyDocumentKind,
  StudyDocumentSummary,
  StudyDocumentVersionMeta,
  StudyProgress,
  StudyStatus,
  StudyTopicSummary,
} from './types';
import { DOCUMENT_KIND_ORDER } from './types';

type Row = Record<string, unknown>;

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const nullableText = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : null);

export const curriculumKeyCandidates = (curriculum: string) => {
  const base = curriculum.trim().toLowerCase();
  return Array.from(new Set([base, base.replace(/-/g, '_'), base.replace(/_/g, '-')])).filter(Boolean);
};

const compareVersion = (a: string, b: string) => {
  const [am, an] = a.split('.').map(Number);
  const [bm, bn] = b.split('.').map(Number);
  return am - bm || an - bn;
};

/** Published version if there is one; otherwise (reviewers only see drafts) the newest draft. */
export const pickCurrentVersion = (versions: StudyDocumentVersionMeta[]): StudyDocumentVersionMeta | null => {
  const published = versions.find((v) => v.status === 'published');
  if (published) return published;
  const drafts = versions.filter((v) => v.status === 'draft').sort((a, b) => compareVersion(b.version, a.version));
  return drafts[0] ?? null;
};

const mapVersion = (row: Row): StudyDocumentVersionMeta => ({
  id: text(row.id),
  version: text(row.version),
  versionDate: nullableText(row.version_date),
  status: text(row.status) as StudyStatus,
  wordCount: Number(row.word_count ?? 0),
  normativeNote: nullableText(row.normative_note),
  sourcesNote: nullableText(row.sources_note),
});

export const mapTopicRows = (rows: Row[]): StudyTopicSummary[] =>
  rows
    .map((row) => {
      const documents = (Array.isArray(row.study_documents) ? (row.study_documents as Row[]) : [])
        .map((doc): StudyDocumentSummary => {
          const versions = (
            Array.isArray(doc.study_document_versions) ? (doc.study_document_versions as Row[]) : []
          ).map(mapVersion);
          return {
            id: text(doc.id),
            kind: text(doc.kind) as StudyDocumentKind,
            title: text(doc.title),
            sortOrder: Number(doc.sort_order ?? 0),
            current: pickCurrentVersion(versions),
          };
        })
        .filter((doc) => doc.current !== null && DOCUMENT_KIND_ORDER.includes(doc.kind))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        id: text(row.id),
        code: text(row.code),
        topicNumber: Number(row.topic_number ?? 0),
        title: text(row.title),
        status: text(row.status) as StudyStatus,
        documents,
      };
    })
    .filter((topic) => topic.documents.length > 0)
    .sort((a, b) => a.topicNumber - b.topicNumber);

const TOPIC_SELECT =
  'id, code, topic_number, title, status, sort_order, study_documents(id, kind, title, sort_order, study_document_versions(id, version, version_date, status, word_count, normative_note, sources_note))';

export const listStudyTopics = async (curriculum: string): Promise<StudyTopicSummary[]> => {
  const { data, error } = await supabase
    .from('study_topics')
    .select(TOPIC_SELECT)
    .in('curriculum_key', curriculumKeyCandidates(curriculum))
    .in('status', ['published', 'draft'])
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return mapTopicRows((data ?? []) as Row[]);
};

const bodyCache = new Map<string, string>();

export const getStudyVersionBody = async (versionId: string): Promise<string> => {
  const cached = bodyCache.get(versionId);
  if (cached !== undefined) return cached;
  const { data, error } = await supabase
    .from('study_document_versions')
    .select('body_md')
    .eq('id', versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Documento no disponible');
  const body = text((data as Row).body_md);
  bodyCache.set(versionId, body);
  return body;
};

const mapAnnotation = (row: Row): StudyAnnotation => ({
  id: text(row.id),
  documentId: text(row.document_id),
  versionId: text(row.version_id),
  kind: text(row.kind) as AnnotationKind,
  color: (nullableText(row.color) as AnnotationColor | null) ?? null,
  spans: Array.isArray(row.spans) ? (row.spans as AnnotationSpan[]) : [],
  anchorBlock: nullableText(row.anchor_block),
  quote: nullableText(row.quote),
  note: nullableText(row.note),
  createdAt: text(row.created_at),
  updatedAt: text(row.updated_at),
});

const ANNOTATION_SELECT =
  'id, document_id, version_id, kind, color, spans, anchor_block, quote, note, created_at, updated_at';

export const listStudyAnnotations = async (documentIds: string[]): Promise<StudyAnnotation[]> => {
  if (documentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('user_study_annotations')
    .select(ANNOTATION_SELECT)
    .in('document_id', documentIds)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapAnnotation);
};

export type NewAnnotation = {
  documentId: string;
  versionId: string;
  kind: AnnotationKind;
  color: AnnotationColor | null;
  spans: AnnotationSpan[];
  anchorBlock: string | null;
  quote: string | null;
  note: string | null;
};

export const createStudyAnnotation = async (input: NewAnnotation): Promise<StudyAnnotation> => {
  const { data, error } = await supabase
    .from('user_study_annotations')
    .insert({
      document_id: input.documentId,
      version_id: input.versionId,
      kind: input.kind,
      color: input.color,
      spans: input.spans,
      anchor_block: input.anchorBlock,
      quote: input.quote,
      note: input.note,
    })
    .select(ANNOTATION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapAnnotation(data as Row);
};

export const updateStudyAnnotation = async (
  id: string,
  patch: Partial<Pick<StudyAnnotation, 'color' | 'note' | 'kind'>>,
): Promise<StudyAnnotation> => {
  const { data, error } = await supabase
    .from('user_study_annotations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ANNOTATION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapAnnotation(data as Row);
};

export const deleteStudyAnnotation = async (id: string): Promise<void> => {
  const { error } = await supabase.from('user_study_annotations').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

const mapProgress = (row: Row): StudyProgress => ({
  documentId: text(row.document_id),
  versionId: text(row.version_id),
  progress: Number(row.progress ?? 0),
  lastBlock: nullableText(row.last_block),
  completedAt: nullableText(row.completed_at),
  updatedAt: text(row.updated_at),
});

export const listStudyProgress = async (documentIds?: string[]): Promise<StudyProgress[]> => {
  let query = supabase
    .from('user_study_progress')
    .select('document_id, version_id, progress, last_block, completed_at, updated_at');
  if (documentIds) {
    if (documentIds.length === 0) return [];
    query = query.in('document_id', documentIds);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapProgress);
};

export const saveStudyProgress = async (
  userId: string,
  input: {
    documentId: string;
    versionId: string;
    progress: number;
    lastBlock: string | null;
    completed?: boolean | null;
  },
): Promise<void> => {
  const row: Row = {
    user_id: userId,
    document_id: input.documentId,
    version_id: input.versionId,
    progress: Math.max(0, Math.min(1, Math.round(input.progress * 10000) / 10000)),
    last_block: input.lastBlock,
    updated_at: new Date().toISOString(),
  };
  if (input.completed === true) row.completed_at = new Date().toISOString();
  if (input.completed === false) row.completed_at = null;
  const { error } = await supabase.from('user_study_progress').upsert(row, { onConflict: 'user_id,document_id' });
  if (error) throw new Error(error.message);
};
