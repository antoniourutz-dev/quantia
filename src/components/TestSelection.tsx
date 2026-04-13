import { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, Hash, Zap, AlertCircle, Timer } from 'lucide-react';
import { SyllabusType, formatSyllabusLabel, PracticeMode } from '../types';

interface TestSelectionProps {
  onStart: (mode: PracticeMode, syllabus?: SyllabusType, count?: number) => void;
  initialSyllabus: SyllabusType | null;
}

type SelectionMode = 'standard' | 'quick' | 'errors' | 'simulacro';

export default function TestSelection({ onStart, initialSyllabus }: TestSelectionProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('standard');
  const [selectedSyllabus, setSelectedSyllabus] = useState<SyllabusType>(initialSyllabus || 'common');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const options = [10, 20, 50];
  const simulacroOptions = [50, 100];
  const [simulacroScope, setSimulacroScope] = useState<'mixed' | SyllabusType>('mixed');
  const [simulacroCount, setSimulacroCount] = useState<number>(50);

  const handleStart = () => {
    if (selectionMode === 'standard') {
      onStart('standard', selectedSyllabus, questionCount);
    } else if (selectionMode === 'quick') {
      onStart('quick_five', 'common', 5);
    } else if (selectionMode === 'errors') {
      onStart('review', 'specific', 10);
    } else if (selectionMode === 'simulacro') {
      onStart('simulacro', simulacroScope === 'mixed' ? undefined : simulacroScope, simulacroCount);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* 1. Mode Selection */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
          <Zap className="text-indigo-600 w-5 h-5" />
          Selecciona el tipo de entrenamiento
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <button
            onClick={() => setSelectionMode('standard')}
            className={`p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-4 text-center ${
              selectionMode === 'standard'
                ? 'border-indigo-600 bg-indigo-50 shadow-xl shadow-indigo-100 ring-4 ring-indigo-500/10'
                : 'border-slate-50 bg-white hover:border-indigo-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-4 rounded-2xl ${selectionMode === 'standard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <BookOpen size={32} />
            </div>
            <div>
              <p className="font-black text-xl text-slate-800">Test por temario</p>
              <p className="text-sm font-medium text-slate-500 mt-2">Bloques estructurados por categoría</p>
            </div>
          </button>

          <button
            onClick={() => setSelectionMode('quick')}
            className={`p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-4 text-center ${
              selectionMode === 'quick'
                ? 'border-amber-500 bg-amber-50 shadow-xl shadow-amber-100 ring-4 ring-amber-500/10'
                : 'border-slate-50 bg-white hover:border-amber-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-4 rounded-2xl ${selectionMode === 'quick' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Zap size={32} />
            </div>
            <div>
              <p className="font-black text-xl text-slate-800">Test rápido</p>
              <p className="text-sm font-medium text-slate-500 mt-2">5 preguntas aleatorias flash</p>
            </div>
          </button>

          <button
            onClick={() => setSelectionMode('errors')}
            className={`p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-4 text-center ${
              selectionMode === 'errors'
                ? 'border-rose-500 bg-rose-50 shadow-xl shadow-rose-100 ring-4 ring-rose-500/10'
                : 'border-slate-50 bg-white hover:border-rose-100 hover:bg-slate-50'
            }`}
          >
            <div className={`p-4 rounded-2xl ${selectionMode === 'errors' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <AlertCircle size={32} />
            </div>
            <div>
              <p className="font-black text-xl text-slate-800">Repaso de fallos</p>
              <p className="text-sm font-medium text-slate-500 mt-2">Enfócate en tus puntos débiles</p>
            </div>
          </button>

          <button
            onClick={() => setSelectionMode('simulacro')}
            className={`p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-4 text-center ${
              selectionMode === 'simulacro'
                ? 'border-slate-700 bg-slate-50 shadow-xl shadow-slate-200 ring-4 ring-slate-900/10'
                : 'border-slate-50 bg-white hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div
              className={`p-4 rounded-2xl ${
                selectionMode === 'simulacro' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Timer size={32} />
            </div>
            <div>
              <p className="font-black text-xl text-slate-800">Simulacro</p>
              <p className="text-sm font-medium text-slate-500 mt-2">Sin feedback hasta el final</p>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Syllabus Selection (Only for standard) */}
      {selectionMode === 'standard' && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
            <BookOpen className="text-indigo-600 w-5 h-5" />
            Selecciona el temario
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setSelectedSyllabus('common')}
              className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                selectedSyllabus === 'common'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-slate-50 bg-white hover:border-indigo-100'
              }`}
            >
              <div className={`p-2 rounded-lg ${selectedSyllabus === 'common' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <CheckCircle2 size={24} />
              </div>
              <span className="font-bold text-lg text-slate-800">Temario {formatSyllabusLabel('common')}</span>
            </button>

            <button
              onClick={() => setSelectedSyllabus('specific')}
              className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                selectedSyllabus === 'specific'
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-slate-50 bg-white hover:border-emerald-100'
              }`}
            >
              <div className={`p-2 rounded-lg ${selectedSyllabus === 'specific' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <CheckCircle2 size={24} />
              </div>
              <span className="font-bold text-lg text-slate-800">Temario {formatSyllabusLabel('specific')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Question Count (Only for standard) */}
      {selectionMode === 'standard' && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
            <Hash className="text-indigo-600 w-5 h-5" />
            Cantidad de preguntas
          </h2>

          <div className="grid grid-cols-3 gap-6">
            {options.map((count) => (
              <button
                key={count}
                onClick={() => setQuestionCount(count)}
                className={`py-6 px-8 rounded-2xl border-2 transition-all duration-300 font-black text-2xl ${
                  questionCount === count
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-50 bg-white text-slate-400 hover:border-indigo-100'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2B. Simulacro Config */}
      {selectionMode === 'simulacro' && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500 space-y-8">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Timer className="text-slate-700 w-5 h-5" />
            Configura el simulacro
          </h2>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cobertura</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => setSimulacroScope('mixed')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                  simulacroScope === 'mixed'
                    ? 'border-slate-800 bg-slate-50'
                    : 'border-slate-50 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`p-2 rounded-lg ${simulacroScope === 'mixed' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg text-slate-800">Mixto</span>
              </button>

              <button
                onClick={() => setSimulacroScope('common')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                  simulacroScope === 'common'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-50 bg-white hover:border-indigo-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${simulacroScope === 'common' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg text-slate-800">Temario {formatSyllabusLabel('common')}</span>
              </button>

              <button
                onClick={() => setSimulacroScope('specific')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                  simulacroScope === 'specific'
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-50 bg-white hover:border-emerald-100'
                }`}
              >
                <div className={`p-2 rounded-lg ${simulacroScope === 'specific' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 size={24} />
                </div>
                <span className="font-bold text-lg text-slate-800">Temario {formatSyllabusLabel('specific')}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cantidad de preguntas</div>
            <div className="grid grid-cols-2 gap-6">
              {simulacroOptions.map((count) => (
                <button
                  key={count}
                  onClick={() => setSimulacroCount(count)}
                  className={`py-6 px-8 rounded-2xl border-2 transition-all duration-300 font-black text-2xl ${
                    simulacroCount === count
                      ? 'border-slate-800 bg-slate-50 text-slate-900'
                      : 'border-slate-50 bg-white text-slate-400 hover:border-slate-200'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              En simulacro no verás la respuesta correcta hasta el final.
            </div>
          </div>
        </div>
      )}

      {/* 4. Action CTA */}
      <button
        onClick={handleStart}
        className={`w-full py-6 rounded-[2rem] font-black text-2xl shadow-2xl transition-all duration-500 flex items-center justify-center gap-4 hover:-translate-y-1 ${
          selectionMode === 'standard' ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700' :
          selectionMode === 'quick' ? 'bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600' :
          selectionMode === 'errors' ? 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700' :
          'bg-slate-800 text-white shadow-slate-200 hover:bg-slate-900'
        }`}
      >
        {selectionMode === 'standard' ? 'Generar Bloque de Test' : 
         selectionMode === 'quick' ? '¡Lanzar Test Rápido!' : selectionMode === 'errors' ? 'Repasar Errores Críticos' : 'Iniciar Simulacro'}
        <ChevronRight size={32} />
      </button>
    </div>
  );
}
