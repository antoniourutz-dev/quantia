import { createId } from './id';
import { getSafeSupabaseSession, supabase } from './supabaseClient';

export type ErrataCategory =
  | 'wrong_answer'
  | 'outdated_law'
  | 'ambiguous_wording'
  | 'typo'
  | 'other';

export interface QuestionErrataReport {
  id: string;
  questionId: string;
  curriculum: string;
  category: ErrataCategory;
  comment: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  /** Where the report is persisted: Supabase (`cloud`) or per-user localStorage fallback (`local`). */
  source: 'cloud' | 'local';
}

export interface SubmitErrataReportInput {
  questionId: string;
  curriculum: string;
  category: ErrataCategory;
  comment?: string | null;
  userId?: string | null;
}

type LocalErrataStore = Record<string, QuestionErrataReport[]>;

const ERRATA_STORAGE_PREFIX = 'quantia.errata_reports.v2';
const REPORT_COLUMNS = 'id, user_id, question_id, curriculum, category, comment, status, created_at';

const getStorageKey = (userId?: string | null) => {
  const normalized = String(userId ?? '').trim() || 'anonymous';
  return `${ERRATA_STORAGE_PREFIX}:${normalized}`;
};

const readLocalReports = (userId?: string | null): LocalErrataStore => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const store: LocalErrataStore = {};
    for (const [qid, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        store[qid] = value as QuestionErrataReport[];
      }
    }
    return store;
  } catch {
    return {};
  }
};

const writeLocalReports = (userId: string | null | undefined, reports: LocalErrataStore) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(reports));
  } catch {
    // Ignore storage quota errors
  }
};

const resolveUserId = async (explicitUserId?: string | null): Promise<string | null> => {
  const trimmed = String(explicitUserId ?? '').trim();
  if (trimmed) return trimmed;
  const session = await getSafeSupabaseSession().catch(() => null);
  return session?.user?.id ?? null;
};

const mapRow = (row: Record<string, unknown>): QuestionErrataReport | null => {
  const questionId = String(row.question_id ?? '').trim();
  if (!questionId) return null;
  return {
    id: String(row.id ?? createId()),
    questionId,
    curriculum: String(row.curriculum ?? ''),
    category: (row.category as ErrataCategory) ?? 'other',
    comment: String(row.comment ?? ''),
    status: (row.status as QuestionErrataReport['status']) ?? 'pending',
    createdAt: String(row.created_at ?? new Date().toISOString()),
    source: 'cloud',
  };
};

const upsertReport = (list: QuestionErrataReport[], report: QuestionErrataReport) => {
  const filtered = list.filter((item) => item.id !== report.id);
  return [report, ...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const submitQuestionErrataReport = async (
  input: SubmitErrataReportInput,
): Promise<QuestionErrataReport> => {
  const questionId = String(input.questionId ?? '').trim();
  const curriculum = String(input.curriculum ?? '').trim() || 'osakidetza_admin';
  const category = input.category;
  const comment = String(input.comment ?? '').trim();
  const userId = await resolveUserId(input.userId);

  let report: QuestionErrataReport = {
    id: createId(),
    questionId,
    curriculum,
    category,
    comment,
    status: 'pending',
    createdAt: new Date().toISOString(),
    source: 'local',
  };

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('question_errata_reports')
        .insert({
          user_id: userId,
          question_id: questionId,
          curriculum,
          category,
          comment,
          status: 'pending',
        })
        .select(REPORT_COLUMNS)
        .single();

      if (!error && data) {
        report = mapRow(data as Record<string, unknown>) ?? { ...report, source: 'cloud' };
      }
    } catch {
      // Fallback to localStorage on network/relation errors (e.g. 42P01)
    }
  }

  const local = readLocalReports(userId);
  local[questionId] = upsertReport(local[questionId] ?? [], report);
  writeLocalReports(userId, local);

  return report;
};

export const getUserErrataReportsForQuestions = async (
  questionIds: string[],
  explicitUserId?: string | null,
): Promise<Record<string, QuestionErrataReport[]>> => {
  const uniqueIds = Array.from(
    new Set(questionIds.map((id) => String(id ?? '').trim()).filter(Boolean)),
  );
  if (uniqueIds.length === 0) return {};

  const userId = await resolveUserId(explicitUserId);
  const local = readLocalReports(userId);
  const result: Record<string, QuestionErrataReport[]> = {};

  for (const id of uniqueIds) {
    if (local[id]?.length) {
      result[id] = [...local[id]];
    }
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('question_errata_reports')
        .select(REPORT_COLUMNS)
        .in('question_id', uniqueIds)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const row of data as Array<Record<string, unknown>>) {
          // RLS may expose other users' reports to quality managers: keep only own reports.
          if (row.user_id != null && String(row.user_id) !== userId) continue;
          const mapped = mapRow(row);
          if (!mapped) continue;
          result[mapped.questionId] = upsertReport(result[mapped.questionId] ?? [], mapped);
          local[mapped.questionId] = upsertReport(local[mapped.questionId] ?? [], mapped);
        }
        writeLocalReports(userId, local);
      }
    } catch {
      // Keep local reports
    }
  }

  return result;
};
