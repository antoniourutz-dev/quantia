import type { PracticeMode, PracticeSessionSummary } from '../types';

const PRACTICE_MODES = new Set<PracticeMode>([
  'standard', 'quick_five', 'weakest', 'random', 'review', 'mixed', 'simulacro', 'anti_trap', 'custom',
]);

export type PracticeActivitySummaryRow = {
  sessionId: string;
  questionId: string;
  mode: string | null;
  surface: string | null;
  viewedAt: string;
  answeredAt: string | null;
  isCorrect: boolean | null;
};

const parsePracticeMode = (value: string | null): PracticeMode | null => {
  const normalized = String(value ?? '').trim().toLowerCase() as PracticeMode;
  return PRACTICE_MODES.has(normalized) ? normalized : null;
};

const validTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
};

export const mergePracticeSessionHistory = (
  sessions: PracticeSessionSummary[],
  activityRows: PracticeActivitySummaryRow[],
): PracticeSessionSummary[] => {
  const merged = new Map(sessions.map((session) => [session.id, { ...session }]));
  const latestAnswers = new Map<string, PracticeActivitySummaryRow>();

  for (const row of activityRows) {
    const mode = parsePracticeMode(row.mode);
    const answeredAt = validTimestamp(row.answeredAt);
    if (!row.sessionId || !row.questionId || !mode || answeredAt == null || row.isCorrect == null) continue;
    if (row.surface === 'study' || row.surface === 'question-bank' || row.surface === 'mistake-review') continue;
    const key = `${row.sessionId}:${row.questionId}`;
    const current = latestAnswers.get(key);
    if (!current || Date.parse(answeredAt) >= Date.parse(current.answeredAt ?? '')) latestAnswers.set(key, row);
  }

  const activitySessions = new Map<string, PracticeActivitySummaryRow[]>();
  for (const row of latestAnswers.values()) {
    const rows = activitySessions.get(row.sessionId) ?? [];
    rows.push(row);
    activitySessions.set(row.sessionId, rows);
  }

  for (const [sessionId, rows] of activitySessions) {
    const existing = merged.get(sessionId);
    if (existing && existing.total > 0) continue;
    rows.sort((left, right) => Date.parse(left.answeredAt ?? '') - Date.parse(right.answeredAt ?? ''));
    const mode = parsePracticeMode(rows[rows.length - 1]?.mode ?? null);
    if (!mode) continue;
    const startedAt = validTimestamp(rows[0]?.viewedAt) ?? rows[0]?.answeredAt ?? '';
    const finishedAt = rows[rows.length - 1]?.answeredAt ?? startedAt;
    merged.set(sessionId, {
      id: sessionId,
      mode,
      title: existing?.title || 'Actividad de test',
      startedAt: existing?.startedAt || startedAt,
      finishedAt: existing?.finishedAt || finishedAt,
      score: rows.reduce((total, row) => total + (row.isCorrect ? 1 : 0), 0),
      total: rows.length,
    });
  }

  return [...merged.values()].sort((left, right) => {
    const leftDate = Date.parse(left.finishedAt || left.startedAt || '');
    const rightDate = Date.parse(right.finishedAt || right.startedAt || '');
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
};

const toLocalDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const calculateActiveDayStreak = (dayKeys: Iterable<string>, referenceDate = new Date()) => {
  const activeDays = new Set([...dayKeys].filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)));
  const cursor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  if (!activeDays.has(toLocalDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDays.has(toLocalDayKey(cursor))) return 0;
  }
  let streak = 0;
  while (activeDays.has(toLocalDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const calculateWeightedAccuracy = <T extends { score: number; total: number }>(rows: T[]) => {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.total), 0);
  if (total === 0) return null;
  const correct = rows.reduce((sum, row) => sum + Math.max(0, Math.min(row.score, row.total)), 0);
  return (correct / total) * 100;
};
