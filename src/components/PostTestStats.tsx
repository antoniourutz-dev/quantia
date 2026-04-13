import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  BarChart3,
  RotateCcw,
  LayoutDashboard,
  Clock,
  Zap,
} from 'lucide-react';
import { ResponsiveContainer, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FinishedTestPayload, PracticeMode, Question } from '../types';

interface PostTestStatsProps {
  payload: FinishedTestPayload;
  questions: Question[];
  mode: PracticeMode;
  onRestart: () => void;
  onGoHome: () => void;
}

export default function PostTestStats({ payload, questions, mode, onRestart, onGoHome }: PostTestStatsProps) {
  const { score, answers } = payload;
  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  const failed = total - score;

  // Calculate average response time
  const avgTimeMs = answers.length > 0 
    ? answers.reduce((acc, curr) => acc + (curr.responseTimeMs ?? 0), 0) / answers.length 
    : 0;
  const avgTimeSec = (avgTimeMs / 1000).toFixed(1);

  // Topics analysis
  const topicStats = questions.reduce((acc, q) => {
    const topic = q.category || 'General';
    if (!acc[topic]) acc[topic] = { total: 0, correct: 0 };
    acc[topic].total += 1;
    const answer = answers.find(a => a.questionId === q.id);
    if (answer?.isCorrect) acc[topic].correct += 1;
    return acc;
  }, {} as Record<string, { total: number, correct: number }>);

  const topicData = Object.entries(topicStats)
    .map(([fullName, stats]) => ({
      fullName,
      name: fullName.length > 28 ? `${fullName.substring(0, 25)}...` : fullName,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      total: stats.total,
    }))
    .sort((a, b) => b.total - a.total || b.accuracy - a.accuracy);

  const topicsSeen = topicData
    .map((item) => item.fullName)
    .filter((name) => name && name !== 'General');
  const topicsSeenPreview = topicsSeen.slice(0, 10);
  const topicsSeenRemaining = Math.max(0, topicsSeen.length - topicsSeenPreview.length);

  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false);

  const reviewItems = useMemo(() => {
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));
    return questions.map((q, index) => {
      const answer = answerMap.get(q.id) ?? null;
      const selected = answer?.selectedOption ?? null;
      const correct = q.correctAnswer;
      const isCorrect = selected != null ? selected === correct : false;
      const findOptionText = (key: string | null) =>
        key ? q.options.find((opt) => opt.id === key)?.text ?? '' : '';

      return {
        index: index + 1,
        id: q.id,
        topic: q.category ?? 'General',
        text: q.text,
        selected,
        selectedText: findOptionText(selected),
        correct,
        correctText: findOptionText(correct),
        isCorrect,
      };
    });
  }, [answers, questions]);

  const reviewFiltered = useMemo(() => {
    if (!showOnlyIncorrect) return reviewItems;
    return reviewItems.filter((item) => !item.isCorrect);
  }, [reviewItems, showOnlyIncorrect]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      {/* Header Result */}
      <div className="relative overflow-hidden bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row items-center gap-12">
        <div className="relative flex-shrink-0">
          <svg className="w-48 h-48 transform -rotate-90">
            <circle cx="96" cy="96" r="88" stroke="#f1f5f9" strokeWidth="16" fill="transparent" />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke={percentage >= 70 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444'}
              strokeWidth="16"
              fill="transparent"
              strokeDasharray={552.9}
              strokeDashoffset={552.9 * (1 - percentage / 100)}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-slate-800">{percentage}%</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Puntuación</span>
          </div>
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left">
          <div>
            <h2 className="text-4xl font-black text-slate-800 mb-2">
              {percentage >= 70 ? '¡Excelente trabajo!' : percentage >= 50 ? 'Buen intento' : 'Necesitas repasar'}
            </h2>
            <p className="text-xl text-slate-500 font-medium leading-relaxed">
              Has completado el test de {total} preguntas con un total de {score} aciertos.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <div className="flex items-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border border-emerald-100">
              <CheckCircle2 size={20} />
              {score} Aciertos
            </div>
            <div className="flex items-center gap-2 px-5 py-3 bg-rose-50 text-rose-700 rounded-2xl font-bold border border-rose-100">
              <XCircle size={20} />
              {failed} Fallos
            </div>
            <div className="flex items-center gap-2 px-5 py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-bold border border-indigo-100">
              <Clock size={20} />
              {avgTimeSec}s / preg
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Topic Breakdown */}
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Rendimiento por Tema</h3>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <BarChart3 size={24} />
            </div>
          </div>
          {topicsSeen.length > 0 ? (
            <div className="mb-8">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Temas vistos ({topicsSeen.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {topicsSeenPreview.map((topic) => (
                  <span
                    key={topic}
                    className="px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-slate-700 text-xs font-bold"
                  >
                    {topic}
                  </span>
                ))}
                {topicsSeenRemaining > 0 ? (
                  <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black">
                    +{topicsSeenRemaining}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-600">
              Temas no disponibles en esta sesión (pendiente de sincronización).
            </div>
          )}
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={160}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '16px', color: '#fff' }}
                  labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.fullName ?? '')}
                  formatter={(value) => [`${value}%`, 'Acierto']}
                />
                <Bar dataKey="accuracy" radius={[0, 8, 8, 0]} barSize={20}>
                  {topicData.map((entry, index) => (
                    <Cell key={index} fill={entry.accuracy >= 70 ? '#10b981' : entry.accuracy >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Speed & Accuracy */}
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Velocidad de Respuesta</h3>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Zap size={24} />
            </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="text-center">
              <span className="text-7xl font-black text-slate-800">{avgTimeSec}</span>
              <span className="text-2xl font-bold text-slate-400 ml-2">segundos</span>
              <p className="text-slate-500 font-medium mt-2">Tiempo medio por pregunta</p>
            </div>

            <div className={`p-6 rounded-[2rem] w-full text-center border-2 ${
              Number(avgTimeSec) < 30 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
            }`}>
              <p className="font-bold">
                {Number(avgTimeSec) < 30 
                  ? '¡Ritmo de examen excelente! Mantén esta velocidad.' 
                  : 'Buen ritmo, pero intenta reducir el tiempo en las preguntas fáciles.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {mode === 'simulacro' ? (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Revisión del simulacro</h3>
              <p className="text-slate-500 font-medium mt-1">
                No se mostró feedback durante la realización. Aquí tienes el desglose completo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOnlyIncorrect(false)}
                className={`px-5 py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                  !showOnlyIncorrect
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setShowOnlyIncorrect(true)}
                className={`px-5 py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                  showOnlyIncorrect
                    ? 'border-rose-600 bg-rose-50 text-rose-700'
                    : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                Solo falladas
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-4">
            {reviewFiltered.map((item) => (
              <div key={item.id} className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-white border border-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        #{item.index}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
                        {item.topic}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                          item.isCorrect
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            : 'bg-rose-50 border-rose-100 text-rose-700'
                        }`}
                      >
                        {item.isCorrect ? 'ACIERTO' : 'FALLO'}
                      </span>
                    </div>
                    <div className="text-lg font-black text-slate-900 leading-snug">{item.text}</div>
                  </div>

                  <div className="shrink-0">
                    {item.isCorrect ? (
                      <CheckCircle2 size={28} className="text-emerald-600" />
                    ) : (
                      <XCircle size={28} className="text-rose-600" />
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Tu respuesta
                    </div>
                    <div className="text-sm font-bold text-slate-700 leading-relaxed">
                      {item.selected ? (
                        <>
                          {item.selected.toUpperCase()}. {item.selectedText}
                        </>
                      ) : (
                        <span className="text-slate-400">Sin responder</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                    <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2">
                      Respuesta correcta
                    </div>
                    <div className="text-sm font-black text-emerald-900 leading-relaxed">
                      {item.correct.toUpperCase()}. {item.correctText}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          onClick={onRestart}
          className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 hover:-translate-y-1"
        >
          <RotateCcw size={24} />
          Repetir Test
        </button>
        <button
          onClick={onGoHome}
          className="flex-1 py-5 bg-white text-slate-700 rounded-[2rem] font-black text-xl shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 hover:-translate-y-1"
        >
          <LayoutDashboard size={24} />
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}
