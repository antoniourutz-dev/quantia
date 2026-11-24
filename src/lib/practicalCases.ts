import { supabase } from './supabaseClient';
import { getPracticeQuestionsByIds } from './quantiaApi';

export interface PracticalCase {
  id: string;
  curriculum_key: string;
  case_number: number;
  title: string;
  statement: string;
  source_title: string;
  source_pages: number[];
  practical_case_questions?: Array<{ count: number }>;
}
export interface CaseQuestion { case_id: string; question_id: number; position: number }
export interface CaseAsset {
  id: string; title: string; source_page: number; position: number; sha256: string;
}

export async function getPracticalCases(curriculum: string): Promise<PracticalCase[]> {
  const { data, error } = await supabase.from('practical_cases')
    .select('id,curriculum_key,case_number,title,statement,source_title,source_pages,practical_case_questions(count)')
    .eq('curriculum_key', curriculum).eq('status', 'published').order('case_number');
  if (error) throw error;
  return data ?? [];
}

export async function getCaseQuestions(caseIds: string[]): Promise<CaseQuestion[]> {
  if (!caseIds.length) return [];
  const { data, error } = await supabase.from('practical_case_questions')
    .select('case_id,question_id,position').in('case_id', caseIds).order('position');
  if (error) throw error;
  return data ?? [];
}

export async function startCaseQuestions(curriculum: string, cases: PracticalCase[]) {
  const links = await getCaseQuestions(cases.map(c => c.id));
  const ids = cases.flatMap(c => links.filter(l => l.case_id === c.id)
    .sort((a,b) => a.position - b.position).map(l => String(l.question_id)));
  if (!ids.length) throw new Error('No hay preguntas disponibles para estos casos.');
  const questions = await getPracticeQuestionsByIds({ curriculum, questionIds: ids, questionScope: 'specific', limit: ids.length });
  if (questions.length !== ids.length || questions.some((q, i) => q.id !== ids[i])) {
    throw new Error('No se han podido cargar todas las preguntas del caso. Vuelve a intentarlo.');
  }
  return questions;
}

export async function getQuestionCase(questionId: string): Promise<PracticalCase | null> {
  // Other banks can use UUIDs or prefixed IDs; they cannot match a preguntas bigint.
  if (!/^[1-9]\d*$/.test(questionId)) return null;
  // Link by primary key, never by the question number shared by other banks.
  const { data: link, error: linkError } = await supabase.from('practical_case_questions')
    .select('case_id').eq('question_id', questionId).maybeSingle();
  if (linkError) throw linkError;
  if (!link) return null;
  const { data, error } = await supabase.from('practical_cases')
    .select('id,curriculum_key,case_number,title,statement,source_title,source_pages')
    .eq('id', link.case_id).single();
  if (error) throw error;
  return data;
}

export async function getCaseAssets(caseId: string): Promise<Array<CaseAsset & { url: string }>> {
  const { data, error } = await supabase.from('practical_case_assets')
    .select('id,title,source_page,position,sha256').eq('case_id', caseId).order('position');
  if (error) throw error;
  // Bytes are RLS protected too; no public bucket, repository asset or signed URL.
  return Promise.all((data ?? []).map(async (asset: CaseAsset) => {
    const { data: chunks, error: chunkError } = await supabase.from('practical_case_asset_chunks')
      .select('part,png_base64').eq('asset_id', asset.id).order('part');
    if (chunkError) throw chunkError;
    if (!chunks?.length || chunks.some((c,i) => c.part !== i)) throw new Error('Imagen incompleta.');
    const raw = atob(chunks.map(c => c.png_base64).join(''));
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
    if (hash !== asset.sha256) throw new Error('No se ha podido verificar la imagen original.');
    // Data URLs live only in component state, avoiding object URL leaks on failed requests.
    return { ...asset, url: `data:image/png;base64,${chunks.map(c => c.png_base64).join('')}` };
  }));
}
