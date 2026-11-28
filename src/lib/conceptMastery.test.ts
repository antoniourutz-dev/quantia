import { describe,expect,it } from 'vitest';
import { assessStage,eligibleConceptQuestions,selectConceptSession,type ConceptQuestion,type ConceptAttempt } from './conceptMastery';
const q=(id:string,stage:ConceptQuestion['conceptMetadata']['stage']='memorizar',origin:ConceptQuestion['conceptMetadata']['origin']='own'):ConceptQuestion=>({id,number:null,text:'Pregunta '+id,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctAnswer:'a',explanation:'',syllabus:'specific',category:null,questionScope:'specific',studyTopicId:'t1',conceptMetadata:{origin,family:'F',stage,section:'1'}});
const a=(id:string,date:string,session:string,ok=true):ConceptAttempt=>({question_id:id,session_id:session,answered_at:date,is_correct:ok});
describe('concept mastery',()=>{
 it('isolates source and topic',()=>{expect(eligibleConceptQuestions([q('1'),q('2','memorizar','academy'),{...q('3'),studyTopicId:'t2'}],'own','t1').map(x=>x.id)).toEqual(['1']);});
 it('never masters insufficient coverage',()=>{expect(assessStage([q('1')],[a('1','2026-01-01','s1'),a('1','2026-01-03','s2')],'memorizar').state).toBe('insufficient');});
 it('requires distinct questions and delayed recovery',()=>{const qs=[q('1'),q('2')], h=[a('1','2026-01-01','s1'),a('2','2026-01-01','s1')];expect(assessStage(qs,h,'memorizar').state).toBe('practiced');expect(assessStage(qs,[...h,a('1','2026-01-03','s2')],'memorizar').state).toBe('consolidated');expect(assessStage(qs,[...h,a('1','2026-01-03','s2',false)],'memorizar').state).toBe('reinforce');});
 it('selects at least one available question per phase in order when possible',()=>{const qs=[q('1'),q('2'),q('3','comprender'),q('4','aplicar')];expect(selectConceptSession(qs,[],'all',3).map(x=>x.conceptMetadata.stage)).toEqual(['memorizar','comprender','aplicar']);});
 it('does not count exact cloned questions twice',()=>{const first=q('1');expect(eligibleConceptQuestions([first,{...first,id:'2'}],'all','t1')).toHaveLength(1);});
});
