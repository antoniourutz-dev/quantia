import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), questions: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { from: mocks.from } }));
vi.mock('./quantiaApi', () => ({ getPracticeQuestionsByIds: mocks.questions }));
import { getCaseAssets, getPracticalCases, getQuestionCase, startCaseQuestions, type PracticalCase } from './practicalCases';
const cases: PracticalCase[] = [1,2].map(n => ({id:`c${n}`,curriculum_key:'org',case_number:n,title:`Caso ${n}`,statement:'Texto original',source_title:'Fuente.pdf',source_pages:[100+n]}));
function query(data: unknown, error: unknown = null) {
  const value = { data, error };
  const q = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(), then: (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve) };
  for (const fn of [q.select,q.eq,q.in,q.order]) fn.mockReturnValue(q);
  q.maybeSingle.mockResolvedValue(value); q.single.mockResolvedValue(value);
  return q;
}
beforeEach(() => { vi.resetAllMocks(); });
describe('practical cases API', () => {
  it('filters the published catalog by active curriculum and leaves assignment enforcement to RLS', async () => {
    const q=query(cases); mocks.from.mockReturnValue(q);
    expect(await getPracticalCases('org')).toEqual(cases);
    expect(q.eq).toHaveBeenCalledWith('curriculum_key','org');
    expect(q.eq).toHaveBeenCalledWith('status','published');
  });
  it('does not use a number-based fallback if the exact question ID has no visible link', async () => {
    const q=query(null); mocks.from.mockReturnValue(q);
    expect(await getQuestionCase('5608')).toBeNull();
    expect(q.eq).toHaveBeenCalledWith('question_id','5608');
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it('keeps case order and question order, using existing specific IDs', async () => {
    mocks.from.mockReturnValue(query([{case_id:'c2',question_id:5615,position:2},{case_id:'c1',question_id:5608,position:1},{case_id:'c2',question_id:5614,position:1}]));
    mocks.questions.mockResolvedValue(['5608','5614','5615'].map(id=>({id})));
    expect((await startCaseQuestions('org',cases)).map(q=>q.id)).toEqual(['5608','5614','5615']);
    expect(mocks.questions).toHaveBeenCalledWith({curriculum:'org',questionIds:['5608','5614','5615'],questionScope:'specific',limit:3});
  });
  it('refuses a partial case instead of starting an incomplete test', async () => {
    mocks.from.mockReturnValue(query([{case_id:'c1',question_id:5608,position:1}]));
    mocks.questions.mockResolvedValue([]);
    await expect(startCaseQuestions('org',cases)).rejects.toThrow('todas las preguntas');
  });
  it('propagates permission and network errors rather than caching an empty catalog', async () => {
    mocks.from.mockReturnValue(query(null,new Error('denied')));
    await expect(getPracticalCases('org')).rejects.toThrow('denied');
  });
  it('rejects missing image chunks', async () => {
    mocks.from.mockReturnValueOnce(query([{id:'a1',sha256:'0'.repeat(64)}])).mockReturnValueOnce(query([]));
    await expect(getCaseAssets('c1')).rejects.toThrow('incompleta');
  });
  it('rejects modified bytes even when the chunk sequence is complete', async () => {
    mocks.from.mockReturnValueOnce(query([{id:'a1',sha256:'0'.repeat(64)}])).mockReturnValueOnce(query([{part:0,png_base64:'aGVsbG8='}]));
    await expect(getCaseAssets('c1')).rejects.toThrow('verificar');
  });
});
