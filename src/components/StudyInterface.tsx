import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  PenTool,
  Save,
  X,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';
import { OptionKey, PracticeMode, Question } from '../types';
import { useAppLocale } from '../lib/locale';
import HighlightableText, { TextHighlight } from './HighlightableText';
import { createId } from '../lib/id';

import { getStudyData, saveStudyData, setLastVisitedStudyQuestion } from '../lib/quantiaApi';

interface StudyInterfaceProps {
  questions: Question[];
  mode: PracticeMode;
  onFinish: () => void | Promise<void>;
  onCancel: () => void;
  curriculum: string;
}

export default function StudyInterface({
  questions,
  curriculum,
  onFinish,
  onCancel,
}: StudyInterfaceProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [highlightsMap, setHighlightsMap] = useState<Record<string, TextHighlight[]>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  
  const [selectedAnswers, setSelectedAnswers] = useState<(OptionKey | null)[]>(
    new Array(questions.length).fill(null),
  );
  
  const [isNoteDrawerOpen, setIsNoteDrawerOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  const currentQuestion = questions[currentIndex];
  const selectedAnswer = selectedAnswers[currentIndex];
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (currentQuestion) {
      setLastVisitedStudyQuestion(currentQuestion.id);
    }
  }, [currentIndex, currentQuestion]);

  useEffect(() => {
    if (questions.length === 0) return;
    
    getStudyData(questions.map(q => q.id)).then((data) => {
      setHighlightsMap(data.highlights);
      setNotesMap(data.notes);
    }).catch(() => {
    });
  }, [questions]);

  const handleAddHighlight = useCallback(async (highlight: Omit<TextHighlight, 'id'>) => {
    if (!currentQuestion) return;
    const newHl: TextHighlight = { ...highlight, id: createId() };
    const nextList = [...(highlightsMap[currentQuestion.id] || []), newHl];
    setHighlightsMap(prev => ({ ...prev, [currentQuestion.id]: nextList }));
    await saveStudyData(currentQuestion.id, { highlights: nextList });
  }, [currentQuestion, highlightsMap]);

  const handleRemoveHighlight = useCallback(async (id: string) => {
    if (!currentQuestion) return;
    const nextList = (highlightsMap[currentQuestion.id] || []).filter(h => h.id !== id);
    setHighlightsMap(prev => ({ ...prev, [currentQuestion.id]: nextList }));
    await saveStudyData(currentQuestion.id, { highlights: nextList });
  }, [currentQuestion, highlightsMap]);
  
  const handleSaveNote = useCallback(async () => {
    if (!currentQuestion) return;
    setSavingNote(true);
    setNotesMap(prev => ({ ...prev, [currentQuestion.id]: currentNote }));
    await saveStudyData(currentQuestion.id, { notes: currentNote });
    setIsNoteDrawerOpen(false);
    setSavingNote(false);
  }, [currentQuestion, currentNote]);

  const handleAnswer = (optionId: OptionKey) => {
    if (selectedAnswer !== null) return;
    const nextSelected = [...selectedAnswers];
    nextSelected[currentIndex] = optionId;
    setSelectedAnswers(nextSelected);

    if (navigator.vibrate) {
      navigator.vibrate(optionId === currentQuestion.correctAnswer ? 10 : [10, 30, 10]);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish();
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const progress = ((currentIndex + 1) / questions.length) * 100;

  if (!currentQuestion) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        {isBasque ? 'Ez dago galderarik kargatuta saio honetarako.' : 'No hay preguntas cargadas para esta sesión.'}
      </div>
    );
  }

  const hasNote = Boolean(notesMap[currentQuestion.id]?.trim());

  return (
    <div className="mx-auto max-w-5xl space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="px-2 sm:px-0">
        <div className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm sm:p-4 mt-2 sm:mt-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-500">
                <PenTool size={14} className="text-indigo-600" />
                <span>{isBasque ? 'Ikasketa Modua' : 'Modo Estudio'}</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {currentIndex + 1} / {questions.length}
             </span>
             <button
               onClick={onCancel}
               className="text-xs mx-1 font-bold text-slate-400 transition-colors hover:text-slate-600"
             >
               {isBasque ? 'Irten' : 'Salir'}
             </button>
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-indigo-600 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mx-2 sm:mx-0 flex flex-col bg-white transition-all duration-500 rounded-3xl sm:rounded-[2.25rem] border border-slate-100 shadow-sm sm:p-6 pb-4 sm:pb-6 relative overflow-hidden">
        
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => {
              setCurrentNote(notesMap[currentQuestion.id] || '');
              setIsNoteDrawerOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              hasNote ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <MessageSquare size={14} />
            {hasNote ? (isBasque ? 'Oharra du' : 'Tiene nota') : (isBasque ? 'Oharra' : 'Nota')}
          </button>
        </div>

        <div className="px-4 sm:px-0 pb-4 pt-4 sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100 sm:border-transparent transition-all">
          <div className="mb-2 flex items-center justify-between gap-2 pr-24">
            <span className="truncate text-[10px] font-black uppercase tracking-widest text-slate-400 max-w-[220px] sm:max-w-xs">
              {currentIndex + 1} · {currentQuestion.category || (isBasque ? 'Praktika' : 'Práctica')}
            </span>
          </div>

          <div className="text-[17px] sm:text-[19px] font-extrabold leading-tight text-slate-800 pr-1 select-text">
            <HighlightableText
              text={currentQuestion.text}
              highlights={highlightsMap[currentQuestion.id] || []}
              onAddHighlight={handleAddHighlight}
              onRemoveHighlight={handleRemoveHighlight}
            />
          </div>
        </div>

        <div className="flex flex-col flex-1 divide-y divide-slate-100 bg-slate-50/30 sm:rounded-2xl sm:border sm:border-slate-100 overflow-hidden mt-2">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedAnswer === option.id;
            const isAnswerCorrect = option.id === currentQuestion.correctAnswer;
            
            let itemClass = 'relative flex w-full items-center justify-between overflow-hidden p-4 text-left transition-all duration-300 group sm:p-5 ';

            if (selectedAnswer === null) {
              itemClass += 'hover:bg-white hover:shadow-xl hover:-translate-y-0.5 cursor-pointer border-transparent';
            } else if (isSelected) {
              itemClass += isAnswerCorrect
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200';
            } else if (isAnswerCorrect) {
              itemClass += 'bg-emerald-50/40 text-emerald-800 border-emerald-100/50';
            } else {
              itemClass += 'opacity-40 grayscale border-transparent';
            }

            return (
              <button
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                disabled={selectedAnswer !== null}
                className={itemClass}
              >
                <div className="relative z-10 flex items-center gap-4 sm:gap-5">
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all duration-500 ${
                      isSelected
                          ? isAnswerCorrect
                            ? 'bg-emerald-500 text-white scale-110'
                            : 'bg-rose-500 text-white scale-110'
                          : isAnswerCorrect && selectedAnswer !== null
                            ? 'bg-emerald-500 text-white scale-105 shadow-md shadow-emerald-100'
                            : selectedAnswer === null
                              ? 'bg-white text-slate-400 border border-slate-200 group-hover:border-indigo-400 group-hover:text-indigo-600'
                              : 'bg-slate-50 text-slate-300'
                    }`}
                  >
                    {option.id.toUpperCase()}
                  </span>
                  <span
                    className={`text-[15px] sm:text-[17px] font-bold leading-snug transition-colors duration-300 ${
                      isSelected || (isAnswerCorrect && selectedAnswer !== null) ? 'text-inherit' : 'text-slate-600'
                    }`}
                  >
                    {option.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Always show explanation in Study Mode once answered */}
        {selectedAnswer !== null && (
          <div className="mt-4 px-4 sm:px-0 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="rounded-2xl bg-indigo-50/50 border border-indigo-100 p-5">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-widest mb-3">
                <Info size={16} />
                {isBasque ? 'Zehaztapena' : 'Explicación detallada'}
              </div>
              <div className="text-slate-700 leading-relaxed font-medium text-[15px] select-text">
                <HighlightableText
                  text={currentQuestion.explanation}
                  highlights={highlightsMap[`${currentQuestion.id}_exp`] || []}
                  onAddHighlight={(hl) => {
                     const fakeId = `${currentQuestion.id}_exp`;
                     const newHl = { ...hl, id: createId() };
                     const nextList = [...(highlightsMap[fakeId] || []), newHl];
                     setHighlightsMap(prev => ({ ...prev, [fakeId]: nextList }));
                     void saveStudyData(fakeId, { highlights: nextList });
                  }}
                  onRemoveHighlight={(id) => {
                     const fakeId = `${currentQuestion.id}_exp`;
                     const nextList = (highlightsMap[fakeId] || []).filter(h => h.id !== id);
                     setHighlightsMap(prev => ({ ...prev, [fakeId]: nextList }));
                     void saveStudyData(fakeId, { highlights: nextList });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="hidden sm:flex items-center justify-between gap-4 px-4 sm:px-0 pt-2 mb-safe">
        <button
          onClick={prevQuestion}
          disabled={currentIndex === 0}
          className={`flex items-center gap-2 rounded-2xl px-6 py-4 font-bold transition-all ${
            currentIndex === 0
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 shadow-sm'
          }`}
        >
          <ChevronLeft size={20} />
          <span>{isBasque ? 'Aurrekoa' : 'Anterior'}</span>
        </button>

        <button
          onClick={nextQuestion}
          className={`flex items-center gap-2 rounded-2xl px-8 py-4 font-bold transition-all shadow-lg ${
            selectedAnswer === null
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5'
          }`}
        >
          <span>
            {currentIndex === questions.length - 1
              ? isBasque ? 'Amaitu' : 'Finalizar estudio'
              : isBasque ? 'Hurrengoa' : 'Siguiente'}
          </span>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="fixed bottom-4 left-4 right-4 z-40 animate-in slide-in-from-bottom-8 fade-in duration-300 sm:hidden">
        <div className="flex items-center gap-2 rounded-2xl bg-white/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl ring-1 ring-slate-200">
          {currentIndex > 0 && (
            <button
              onClick={prevQuestion}
              className="flex shrink-0 items-center justify-center rounded-xl p-3.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-800"
            >
              <ChevronLeft size={22} className="relative -left-[1px]" />
            </button>
          )}
          
          <button
            onClick={nextQuestion}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-bold text-white shadow-md transition-all active:scale-[0.98] ${
              selectedAnswer === null ? 'bg-slate-800 shadow-slate-800/20' : 'bg-indigo-600 shadow-indigo-600/30'
            }`}
          >
            {currentIndex === questions.length - 1
              ? isBasque ? 'Amaitu' : 'Finalizar'
              : isBasque ? 'Hurrengoa' : 'Siguiente'}
            <ChevronRight size={20} className="relative left-[1px]" />
          </button>
        </div>
      </div>

      {isNoteDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsNoteDrawerOpen(false)} />
          <div className="relative w-full max-w-sm h-[70vh] bottom-0 absolute sm:h-full sm:right-0 bg-white shadow-2xl rounded-t-[2.5rem] sm:rounded-none sm:rounded-l-[2.5rem] flex flex-col transition-transform animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
             <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <MessageSquare size={18} className="text-amber-500" />
                  {isBasque ? 'Nire apunteak' : 'Mis anotaciones personales'}
                </div>
                <button onClick={() => setIsNoteDrawerOpen(false)} className="p-2 -mr-2 text-slate-400 hover:bg-slate-50 rounded-full">
                  <X size={20} />
                </button>
             </div>
             <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <p className="text-xs text-slate-500 font-medium mb-4">
                  {isBasque ? 'Idatzi hemen galdera honi buruzko ohartxoak. Zuretzat bakarrik.' : 'Escribe aquí anotaciones, reglas mnemotécnicas o dudas sobre esta pregunta.'}
                </p>
                <textarea
                  className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-700 font-medium text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400"
                  placeholder={isBasque ? 'Idatzi zure oharra...' : 'Escribe tu nota...'}
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                />
             </div>
             <div className="p-6 border-t border-slate-100">
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white font-bold py-4 hover:bg-slate-800 disabled:opacity-70 disabled:cursor-wait"
                >
                  {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isBasque ? 'Gorde oharra' : 'Guardar nota'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
