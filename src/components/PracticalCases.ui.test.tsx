import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => ({ getQuestionCase: vi.fn(), getCaseAssets: vi.fn(), startCaseQuestions: vi.fn(), getPracticalCases: vi.fn() }));
vi.mock('../lib/practicalCases', () => api);
import PracticalCaseContext from './PracticalCaseContext';
import PracticalCaseSelector from './PracticalCaseSelector';
import TestInterface from './TestInterface';
import TestSelection from './TestSelection';
import type { PracticalCase } from '../lib/practicalCases';
const case1: PracticalCase = {id:'c1',case_number:1,curriculum_key:'org',title:'OSANEBI',statement:'Enunciado original completo',source_title:'Original.pdf',source_pages:[102,103]};
const case2: PracticalCase = {...case1,id:'c2',case_number:2,title:'KIROLAK',statement:'Segundo enunciado'};
beforeEach(() => { vi.resetAllMocks(); api.getCaseAssets.mockResolvedValue([]); });
describe('practical cases UI', () => {
  it('keeps draft statement marks across questions, isolates cases, supports clearing and forgets them on exit', async () => {
    api.getQuestionCase.mockImplementation(async (id: string) => id === '5614' ? case2 : case1);
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const { container, rerender, unmount } = render(<PracticalCaseContext questionId="5608" />);
    await screen.findByText(case1.statement);
    const highlight = () => {
      const textNode = container.querySelector('.highlightable-text')!.firstChild!.firstChild;
      const selection = vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false, anchorNode: textNode, focusNode: textNode, anchorOffset: 0, focusOffset: 9,
        getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 100, left: 100, width: 70, height: 20 }) }),
        removeAllRanges: vi.fn(),
      } as unknown as Selection);
      fireEvent(document, new Event('selectionchange'));
      fireEvent.click(screen.getByRole('button', { name: 'Borrador · Amarillo' }));
      selection.mockRestore();
    };
    highlight();
    expect(container.querySelectorAll('.border-dashed')).toHaveLength(1);
    rerender(<PracticalCaseContext questionId="5609" />);
    await screen.findByRole('button', { name: 'Limpiar subrayado del enunciado' });
    expect(container.querySelectorAll('.border-dashed')).toHaveLength(1);
    rerender(<PracticalCaseContext questionId="5614" />);
    await screen.findByText(case2.statement);
    expect(container.querySelector('.border-dashed')).toBeNull();
    rerender(<PracticalCaseContext questionId="5608" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Limpiar subrayado del enunciado' }));
    expect(container.querySelector('.border-dashed')).toBeNull();
    highlight();
    expect(container.querySelectorAll('.border-dashed')).toHaveLength(1);
    expect(storageWrite).not.toHaveBeenCalled();
    unmount();
    const next = render(<PracticalCaseContext questionId="5608" />);
    await screen.findByText(case1.statement);
    expect(next.container.querySelector('.border-dashed')).toBeNull();
    storageWrite.mockRestore();
  });
  it('leaves official questions available without a practical-case lookup, even with a numeric ID', () => {
    const question={id:'5608',number:460,text:'Pregunta oficial independiente',practiceSource:'official' as const,options:[{id:'a' as const,text:'Respuesta oficial'}],correctAnswer:'a' as const,explanation:'Explicación',syllabus:'specific' as const,category:'Ley',questionScope:'specific' as const};
    render(<TestInterface questions={[question]} mode="standard" onFinish={vi.fn()} onCancel={vi.fn()} activityContext={{userId:'learner',curriculum:'official',sessionId:'s2'}} />);
    expect(screen.getByRole('button',{name:/Respuesta oficial/})).toBeEnabled();
    expect(api.getQuestionCase).not.toHaveBeenCalled();
  });
  it('shows the mode only when the assigned curriculum has cases', async () => {
    api.getPracticalCases.mockResolvedValueOnce([case1]).mockResolvedValueOnce([]);
    const props={lawOptions:[],onStart:vi.fn(),onStartChallenge:vi.fn(),onStartLawTest:vi.fn(),onStartCustomTest:vi.fn(),onStartCustomPractice:vi.fn(),initialSyllabus:null,userId:'learner'};
    const {rerender}=render(<TestSelection {...props} curriculum="org" />);
    expect(await screen.findByRole('button',{name:'Casos prácticos'})).toBeInTheDocument();
    rerender(<TestSelection {...props} curriculum="other" />);
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Casos prácticos'})).not.toBeInTheDocument());
  });
  it.each(['standard','simulacro','custom'] as const)('requires context in the existing %s engine before allowing an answer', async mode => {
    let finish!: (c: PracticalCase) => void;
    api.getQuestionCase.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    const question={id:'5608',number:460,text:'Pregunta dependiente',options:[{id:'a' as const,text:'Respuesta primera'},{id:'b' as const,text:'Respuesta segunda'}],correctAnswer:'a' as const,explanation:'Explicación',syllabus:'specific' as const,category:'Procesos',questionScope:'specific' as const};
    render(<TestInterface questions={[question]} mode={mode} onFinish={vi.fn()} onCancel={vi.fn()} activityContext={{userId:'learner',curriculum:'org',sessionId:'s1'}} />);
    expect(screen.getByRole('button',{name:/Respuesta primera/})).toBeDisabled();
    await act(async()=>{finish(case1);});
    expect(await screen.findByText('Enunciado original completo')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Respuesta primera/})).toBeEnabled();
  });
  it('starts one case or all cases through the supplied existing engine callback', async () => {
    const onStart=vi.fn(); api.startCaseQuestions.mockResolvedValue([{id:'5608'}]);
    render(<PracticalCaseSelector cases={[case1,case2]} curriculum="org" onStart={onStart} />);
    fireEvent.click(screen.getByRole('button',{name:/Todos los casos/}));
    await waitFor(()=>expect(onStart).toHaveBeenCalledWith([{id:'5608'}],'Todos los casos prácticos'));
    fireEvent.click(screen.getByRole('button',{name:/Caso 1 OSANEBI/}));
    await waitFor(()=>expect(api.startCaseQuestions).toHaveBeenLastCalledWith('org',[case1]));
  });
  it('replaces the context at a case boundary and removes it for unrelated questions', async () => {
    api.getQuestionCase.mockResolvedValueOnce(case1).mockResolvedValueOnce(case2).mockResolvedValueOnce(null);
    const {rerender}=render(<PracticalCaseContext questionId="5608" />);
    expect(await screen.findByText('Enunciado original completo')).toBeInTheDocument();
    rerender(<PracticalCaseContext questionId="5614" />);
    expect(await screen.findByText('Segundo enunciado')).toBeInTheDocument();
    expect(screen.queryByText('Enunciado original completo')).not.toBeInTheDocument();
    rerender(<PracticalCaseContext questionId="other" />);
    await waitFor(()=>expect(screen.queryByRole('region',{name:'Enunciado del caso práctico'})).not.toBeInTheDocument());
  });
  it('ignores a stale context response after moving to another question', async () => {
    let finish!: (c: PracticalCase) => void;
    api.getQuestionCase.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(case2);
    const {rerender}=render(<PracticalCaseContext questionId="5608" />);
    rerender(<PracticalCaseContext questionId="5614" />);
    expect(await screen.findByText('Segundo enunciado')).toBeInTheDocument();
    finish(case1);
    await waitFor(()=>expect(screen.queryByText('Enunciado original completo')).not.toBeInTheDocument());
  });
  it('keeps answers blocked until original assets load and supports retry after errors', async () => {
    api.getQuestionCase.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(case1);
    const ready=vi.fn();
    render(<PracticalCaseContext questionId="5608" onStatusChange={ready} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido comprobar');
    expect(ready).not.toHaveBeenCalledWith('5608',true);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await screen.findByText('Enunciado original completo');
    expect(ready).toHaveBeenLastCalledWith('5608',true);
  });
});
