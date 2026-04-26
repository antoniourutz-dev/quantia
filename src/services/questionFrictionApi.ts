import { supabase, getSafeSupabaseSession } from '../lib/supabaseClient';
import type { QuestionFrictionItem, QuestionFrictionTag } from '../domain/questionFriction/questionFrictionTypes';

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const getUserQuestionFriction = async (
  userId: string,
  curriculum: string,
  limit = 20,
): Promise<QuestionFrictionItem[]> => {
  const normalizedUserId = String(userId ?? '').trim();
  const normalizedCurriculum = String(curriculum ?? '').trim();
  if (!normalizedUserId || !normalizedCurriculum) return [];

  const session = await getSafeSupabaseSession();
  if (!session?.user?.id || session.user.id !== normalizedUserId) return [];

  const { data, error } = await supabase.rpc('get_user_question_friction', {
    p_user_id: normalizedUserId,
    p_curriculum: normalizedCurriculum,
    p_limit: Math.max(1, Math.min(100, Math.trunc(limit))),
  } as Record<string, unknown>);

  if (error) throw new Error(error.message || 'No se ha podido cargar friccion por pregunta.');

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    questionId: String(row.question_id ?? ''),
    curriculum: String(row.curriculum ?? normalizedCurriculum),
    prompt: String(row.prompt ?? ''),
    topic: typeof row.topic === 'string' ? row.topic : null,
    attemptsTotal: toNumber(row.attempts_total),
    wrongTotal: toNumber(row.wrong_total),
    correctTotal: toNumber(row.correct_total),
    errorRate: toNumber(row.error_rate),
    wrongStreak: toNumber(row.wrong_streak),
    repeatWrongCount: toNumber(row.repeat_wrong_count),
    simulacroWrongCount: toNumber(row.simulacro_wrong_count),
    normalWrongCount: toNumber(row.normal_wrong_count),
    lastSeenAt: typeof row.last_seen_at === 'string' ? row.last_seen_at : null,
    lastWrongAt: typeof row.last_wrong_at === 'string' ? row.last_wrong_at : null,
    frictionScore: toNumber(row.friction_score),
    primaryTag: String(row.primary_tag ?? 'mixed') as QuestionFrictionTag,
  }));
};
