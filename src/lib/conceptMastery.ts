import type { Question } from '../types';

export const STAGES = ['memorizar', 'comprender', 'aplicar'] as const;
export type Stage = typeof STAGES[number];
export type Origin = 'own' | 'academy' | 'official';
export type OriginFilter = 'all' | 'own' | 'academy';
export type ConceptQuestion = Question & { conceptMetadata: { origin: Origin; family: string; stage: Stage; section: string }; studyTopicId: string };
export type ConceptAttempt = { question_id: string; session_id: string; answered_at: string; is_correct: boolean };
export type StageState = 'insufficient' | 'pending' | 'reinforce' | 'practiced' | 'consolidated';
export const RECOVERY_MS = 24 * 60 * 60 * 1000;

const fingerprint = (q: ConceptQuestion) => {
  const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  return [normalize(q.text), ...q.options.map(o => normalize(o.text)).sort()].join('|');
};
export const eligibleConceptQuestions = (questions: ConceptQuestion[], origin: OriginFilter, topicId: string) => {
  const seen = new Set<string>();
  return questions.filter(q => {
    if (q.studyTopicId !== topicId || !q.correctAnswer || (origin !== 'all' && q.conceptMetadata.origin !== origin)) return false;
    const key = [q.conceptMetadata.family,q.conceptMetadata.stage,fingerprint(q)].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const validAttempts = (attempts: ConceptAttempt[], ids: Set<string>) => attempts
  .filter(a => ids.has(a.question_id) && Number.isFinite(Date.parse(a.answered_at)))
  .sort((a,b) => Date.parse(a.answered_at) - Date.parse(b.answered_at));
export function assessStage(questions: ConceptQuestion[], attempts: ConceptAttempt[], stage: Stage) {
  const items = questions.filter(q => q.conceptMetadata.stage === stage);
  const ids = new Set(items.map(q => q.id));
  const events = validAttempts(attempts,ids);
  const latest = new Map<string,ConceptAttempt>();
  for (const a of events) latest.set(a.question_id,a);
  const correctDistinct = [...latest.values()].filter(a => a.is_correct).length;
  const available = items.length;
  let state: StageState = 'pending';
  if (available < 2) state = 'insufficient';
  else if (correctDistinct < 2) state = events.some(a => !a.is_correct) ? 'reinforce' : 'pending';
  else {
    state = 'practiced';
    const clean = events.filter(a => a.is_correct);
    for (let i=0;i<clean.length;i++) {
      const recovery=clean[i];
      if (latest.get(recovery.question_id)!==recovery) continue;
      const prior = clean.slice(0,i).filter(a=>a.session_id!==recovery.session_id && Date.parse(recovery.answered_at)-Date.parse(a.answered_at)>=RECOVERY_MS);
      if (new Set(prior.map(a=>a.question_id)).size>=2 && prior.some(a=>a.question_id!==recovery.question_id) && ![...latest.values()].some(a=>!a.is_correct)) {state='consolidated';break;}
    }
  }
  return {stage,available,correctDistinct,state};
}
export function selectConceptSession(questions: ConceptQuestion[], attempts: ConceptAttempt[], stage: Stage|'all', limit: number) {
  const latest = new Map<string,ConceptAttempt>();
  for(const a of validAttempts(attempts,new Set(questions.map(q=>q.id)))) latest.set(a.question_id,a);
  const sort=(a:ConceptQuestion,b:ConceptQuestion)=>{
    const aa=latest.get(a.id),bb=latest.get(b.id);
    const rank=(v:ConceptAttempt|undefined)=>v?(v.is_correct?2:0):1;
    return rank(aa)-rank(bb) || (aa?Date.parse(aa.answered_at):0)-(bb?Date.parse(bb.answered_at):0) || a.id.localeCompare(b.id);
  };
  const pool = stage==='all'?STAGES:[stage];
  const perStage = pool.map(s=>questions.filter(q=>q.conceptMetadata.stage===s).sort(sort));
  const picked:ConceptQuestion[]=[];
  const cap=Math.max(0,Math.min(limit,questions.length));
  for(let index=0;picked.length<cap;index++){
    let added=false;
    for(const items of perStage){const q=items[index];if(q && picked.length<cap){picked.push(q);added=true;}}
    if(!added)break;
  }
  return picked.sort((a,b)=>STAGES.indexOf(a.conceptMetadata.stage)-STAGES.indexOf(b.conceptMetadata.stage));
}
