import type { Question } from '../types';
import { supabase } from './supabaseClient';

export type QuestionEnergy = { question_id: string; attempts: number; correct: number };

export async function getChallengeTopicEnergy(questionIds: string[], signal: AbortSignal) {
  const byQuestion = new Map<string, QuestionEnergy>();
  for (let offset = 0; offset < questionIds.length; offset += 500) {
    const { data, error } = await supabase.schema('app').rpc('get_challenge_question_energy', {
      p_question_ids: questionIds.slice(offset, offset + 500),
    }).abortSignal(signal);
    if (error) throw error;
    for (const row of (data ?? []) as QuestionEnergy[]) byQuestion.set(row.question_id, row);
  }
  return byQuestion;
}

export function summarizeTopicEnergy(questions: Question[], energy: ReadonlyMap<string, QuestionEnergy>) {
  let correct = 0;
  let attempts = 0;
  let practiced = 0;
  let gradable = 0;
  for (const question of questions) {
    if (question.correctAnswer == null) continue;
    gradable += 1;
    const row = energy.get(question.id);
    if (!row?.attempts) continue;
    practiced += 1;
    attempts += row.attempts;
    correct += row.correct;
  }
  return { practiced, gradable, rate: attempts ? Math.round(100 * correct / attempts) : null };
}
