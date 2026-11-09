import { CHALLENGE_OPTIONS, type ChallengeResult, type ChallengeScope } from './challenge';
import { supabase } from './supabaseClient';

export async function getChallengeRanking(
  curriculum: string,
  userId: string,
  scope: ChallengeScope,
  gradedTotal: number,
  signal: AbortSignal,
): Promise<ChallengeResult[]> {
  const { count, title } = CHALLENGE_OPTIONS[scope];
  const app = supabase.schema('app');
  const ranking: ChallengeResult[] = [];
  const pageSize = 10;
  for (let offset = 0; ranking.length < 3; offset += pageSize) {
    const { data, error } = await app.from('practice_sessions')
      .select('session_id, started_at, score, total')
      .eq('user_id', userId)
      .eq('curriculum', curriculum)
      .eq('mode', 'custom')
      .eq('title', title)
      .eq('total', gradedTotal)
      .eq('batch_size', count)
      .order('score', { ascending: false })
      .order('started_at', { ascending: true })
      .order('session_id', { ascending: true })
      .range(offset, offset + pageSize - 1)
      .abortSignal(signal);
    if (error) throw error;
    for (const row of data ?? []) {
      // The sync endpoint creates the session before recording its answers.
      // A failed sync must never place an incomplete session on the leaderboard.
      const { count: recorded, error: countError } = await app.from('question_attempt_events')
        .select('question_id', { count: 'exact', head: true })
        .eq('session_id', row.session_id)
        .eq('user_id', userId)
        .abortSignal(signal);
      if (countError) throw countError;
      if (recorded !== gradedTotal) continue;
      ranking.push({ id: row.session_id, startedAt: row.started_at, correct: row.score, total: row.total });
      if (ranking.length === 3) break;
    }
    if ((data?.length ?? 0) < pageSize) break;
  }
  return ranking;
}
