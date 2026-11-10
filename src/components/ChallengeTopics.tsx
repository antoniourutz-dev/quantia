import { useEffect, useState } from 'react';
import { ChevronRight, Info, Zap } from 'lucide-react';
import TopicQuestionBattery from './TopicQuestionBattery';
import type { Question } from '../types';
import { getCurriculumCategoryGroupLabel, getQuestionBankSnapshot } from '../lib/quantiaApi';
import { getChallengeTopicEnergy, summarizeTopicEnergy, type QuestionEnergy } from '../lib/challengeTopicEnergy';

type Props = {
  curriculum: string;
  userId: string | null;
  syncing: boolean;
  isBasque: boolean;
  onStart: (questions: Question[], title: string) => void;
};
type Topic = { label: string; questions: Question[] };

export default function ChallengeTopics({ curriculum, userId, syncing, isBasque, onStart }: Props) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [bankError, setBankError] = useState(false);
  const [energy, setEnergy] = useState<Map<string, QuestionEnergy> | null>(null);
  const [energyError, setEnergyError] = useState(false);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getQuestionBankSnapshot({ curriculum, questionScope: 'specific', maxQuestions: 5000 }).then(
      (questions) => {
        if (!active) return;
        const groups = new Map<string, Question[]>();
        const seen = new Set<string>();
        for (const question of questions) {
          const label = getCurriculumCategoryGroupLabel(curriculum, question.category);
          if (!label || !/^Temas?\s+\d+/i.test(label) || seen.has(question.id)) continue;
          seen.add(question.id);
          const group = groups.get(label) ?? [];
          group.push(question);
          groups.set(label, group);
        }
        setTopics(Array.from(groups, ([label, questions]) => ({ label, questions }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true })));
      },
      () => { if (active) setBankError(true); },
    );
    return () => { active = false; };
  }, [curriculum]);

  useEffect(() => {
    if (!topics || !userId || syncing) return;
    const controller = new AbortController();
    const ids = topics.flatMap(({ questions }) => questions.filter(q => q.correctAnswer != null).map(q => q.id));
    void getChallengeTopicEnergy(ids, controller.signal).then(
      (rows) => {
        if (controller.signal.aborted) return;
        setEnergy(rows);
        setEnergyError(false);
      },
      () => { if (!controller.signal.aborted) setEnergyError(true); },
    );
    return () => controller.abort();
  }, [syncing, topics, userId]);

  if (bankError) return <p role="alert" className="text-sm text-rose-700">{isBasque ? 'Ezin izan dira gaiak kargatu.' : 'No se han podido cargar los temas.'}</p>;
  if (!topics) return <p role="status" className="text-sm text-slate-600">{isBasque ? 'Gaiak kargatzen…' : 'Cargando temario específico…'}</p>;
  if (!topics.length) return <p className="text-sm text-slate-600">{isBasque ? 'Oposizio honek ez du gai ofizialik esleituta.' : 'Esta oposición aún no tiene preguntas agrupadas por temas oficiales.'}</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-900 p-5 text-white">
        <h4 className="flex items-center gap-2 text-lg font-black"><Zap size={20} className="text-amber-300" aria-hidden="true" />{isBasque ? 'Gaien energia' : 'Energía por temas'}</h4>
        <p className="mt-2 text-sm text-indigo-100">{isBasque ? 'Energia galdera bakoitzeko azken hiru erantzunek ematen dute. Sakatu gai bat proba osoa hasteko.' : 'La energía refleja tus aciertos en las últimas tres respuestas de cada pregunta. Toca un tema para hacer el test completo.'}</p>
      </div>
      {energyError ? <p role="status" className="text-sm text-rose-700">{isBasque ? 'Ezin izan da energia kargatu.' : 'No se ha podido cargar la energía. Puedes hacer los tests igualmente.'}</p>
        : userId && (syncing || !energy) ? <p role="status" className="text-sm text-slate-600">{isBasque ? 'Energia eguneratzen…' : 'Actualizando energía…'}</p> : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {topics.map(({ label, questions }, index) => {
          const progress = energy && !energyError ? summarizeTopicEnergy(questions, energy) : null;
          const rate = progress?.rate ?? null;
          const status = rate != null ? `${rate}%` : (energyError || (!energy && userId)) ? '—' : isBasque ? 'Entrenatu gabe' : 'Sin entrenar';
          return (
            <li key={label} className={openTopic === label ? "lg:col-span-2" : undefined}>
              <div className="relative rounded-2xl border border-indigo-100 bg-white shadow-sm">
              <button type="button" onClick={() => onStart(questions, `Temas · ${label}`)}
                className="group flex h-full w-full items-center gap-3 rounded-2xl p-4 pr-16 text-left transition hover:bg-indigo-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 motion-reduce:transition-none">
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block text-sm font-bold text-slate-900 sm:text-base">{label}</span>
                  <span className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-600">
                    <span>{questions.length} {isBasque ? 'galdera' : 'preguntas'}</span>
                    <span className="font-black text-indigo-800">{status}</span>
                  </span>
                  <span className="relative block h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-400 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${rate ?? 0}%` }} />
                  </span>
                  <span className="block text-xs text-slate-600">
                    {progress && <>{progress.practiced}/{progress.gradable} {isBasque ? 'galdera landuta' : 'preguntas practicadas'} · </>}
                    <span className="font-bold text-indigo-700">{isBasque ? 'Proba osoa hasi' : 'Hacer test completo'}</span>
                  </span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-indigo-700" aria-hidden="true" />
              </button>
                <button type="button" aria-expanded={openTopic === label}
                  aria-controls={openTopic === label ? `topic-details-${index}` : undefined}
                  aria-label={isBasque ? `${label}: galderen xehetasunak` : `${label}: detalle de las preguntas`}
                  onClick={() => setOpenTopic(current => current === label ? null : label)}
                  className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                  <Info size={18} aria-hidden="true" />
                </button>
              </div>
              {openTopic === label && <div id={`topic-details-${index}`} className="mt-2">
                <TopicQuestionBattery questions={questions} energy={energyError ? null : energy} isBasque={isBasque}
                  onStart={selected => onStart(selected, `Temas · Más falladas · ${label}`)} />
              </div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
