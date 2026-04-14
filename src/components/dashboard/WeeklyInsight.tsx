import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Lightbulb, TrendingUp } from 'lucide-react';
import { useAppLocale } from '../../lib/locale';

interface WeeklyInsightProps {
  data: Array<{ name: string; questions: number }>;
  summary: string;
  deltaLabel: string;
}

export default function WeeklyInsight({ data, summary, deltaLabel: delta }: WeeklyInsightProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';

  return (
    <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-premium flex flex-col md:flex-row gap-16 items-center relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

      <div className="flex-1 w-full h-[280px] relative">
        <div className="absolute inset-0 bg-slate-50/50 rounded-[2rem] -m-4 z-0 border border-slate-50 shadow-inner-soft"></div>
        <ResponsiveContainer width="100%" height="100%" className="relative z-10">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }} dy={15} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
              contentStyle={{
                backgroundColor: '#0a0a1a',
                border: 'none',
                borderRadius: '20px',
                color: '#fff',
                padding: '12px 20px',
              }}
              itemStyle={{ color: '#fff', fontWeight: '900', fontSize: '14px' }}
            />
            <Bar dataKey="questions" fill="#4f46e5" radius={[10, 10, 10, 10]} barSize={36}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={index === new Date().getDay() - 1 ? '#4f46e5' : '#e2e8f0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 space-y-8 max-w-lg">
        <div className="inline-flex p-5 bg-indigo-50 rounded-[2rem] text-indigo-600 shadow-sm shadow-indigo-100">
          <Lightbulb size={36} className="fill-indigo-600/10" />
        </div>

        <div className="space-y-4">
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
            {isBasque ? 'Asteko analisia' : 'Analisis semanal'}
          </h3>
          <p className="text-xl text-slate-500 font-medium leading-relaxed antialiased">
            {summary}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 text-emerald-600 font-black text-lg bg-emerald-50 px-8 py-4 rounded-[2rem] w-fit border border-emerald-100 shadow-sm">
            <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
              <TrendingUp size={20} />
            </div>
            {delta}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-2">
            {isBasque ? 'Errendimendu algoritmoa aktibo' : 'Algoritmo de rendimiento activo'}
          </p>
        </div>
      </div>
    </div>
  );
}
