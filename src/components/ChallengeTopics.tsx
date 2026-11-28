import { useEffect, useState } from 'react';
import { ChevronRight, Info, Zap } from 'lucide-react';
import C1TopicPractice from './C1TopicPractice';
import TopicQuestionBattery from './TopicQuestionBattery';
import { orderTopicQuestions } from '../lib/challenge';
import type { Question, SyllabusType, TopicPracticeContext } from '../types';
import { isSingleScopeCurriculum, isLawSelectionCurriculum } from '../lib/locale';
import { getCurriculumCategoryGroupLabel, getQuestionBankSnapshot } from '../lib/quantiaApi';
import { getChallengeTopicEnergy, summarizeTopicEnergy, type QuestionEnergy } from '../lib/challengeTopicEnergy';

type Props = {
  curriculum: string;
  userId: string | null;
  syncing: boolean;
  isBasque: boolean;
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  onStart: (questions: Question[], title: string, topic: TopicPracticeContext) => void;
};
type Topic = { scope: SyllabusType; label: string; questions: Question[] };
const topicKey = (topic: Topic) => `${topic.scope}:${topic.label}`;

// Scope colors identify the syllabus, not the student's mastery.
const scopeStyles = {
  common: {
    selected: 'border-teal-600 bg-teal-50 text-teal-950 shadow-sm',
    idle: 'border-teal-200 bg-teal-50/30 text-teal-900 hover:bg-teal-50',
    dot: 'bg-teal-600',
    focus: 'focus-visible:outline-teal-600',
    card: 'border-teal-200 border-l-4 border-l-teal-500 bg-white',
    hover: 'hover:bg-teal-50/40',
    accent: 'text-teal-700',
    info: 'border-teal-200 text-teal-700 hover:bg-teal-50',
  },
  specific: {
    selected: 'border-indigo-600 bg-indigo-50 text-indigo-950 shadow-sm',
    idle: 'border-indigo-200 bg-indigo-50/30 text-indigo-900 hover:bg-indigo-50',
    dot: 'bg-indigo-600',
    focus: 'focus-visible:outline-indigo-600',
    card: 'border-indigo-100 border-l-4 border-l-indigo-500 bg-white',
    hover: 'hover:bg-indigo-50/40',
    accent: 'text-indigo-700',
    info: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
  },
} as const;

export default function ChallengeTopics(props: Props) {
  if (['gv-adm-c1-2026', 'gv-administrativo-c1-2026'].includes(props.curriculum.toLowerCase().replace(/_/g, '-'))) {
    return <C1TopicPractice userId={props.userId} randomize={props.randomize} onRandomizeChange={props.onRandomizeChange} onStart={props.onStart} />;
  }
  return <StandardChallengeTopics {...props} />;
}

function StandardChallengeTopics({ curriculum, userId, syncing, isBasque, randomize, onRandomizeChange, onStart }: Props) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [bankError, setBankError] = useState(false);
  const [partialError, setPartialError] = useState(false);
  const [selectedScope, setSelectedScope] = useState<SyllabusType>('specific');
  const [energy, setEnergy] = useState<Map<string, QuestionEnergy> | null>(null);
  const [energyError, setEnergyError] = useState(false);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setTopics(null);
    setBankError(false);
    setPartialError(false);
    setEnergy(null);
    setEnergyError(false);
    setOpenTopic(null);
    const scopes: SyllabusType[] = isSingleScopeCurriculum(curriculum) || isLawSelectionCurriculum(curriculum)
      ? ['specific']
      : ['common', 'specific'];
    void Promise.allSettled(scopes.map(async (scope) => {
      const questions = await getQuestionBankSnapshot({ curriculum, questionScope: scope, maxQuestions: 5000 });
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
      return Array.from(groups, ([label, questions]) => ({ scope, label, questions }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
    })).then((results) => {
      if (!active) return;
      const loaded = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      const failures = results.filter(result => result.status === 'rejected').length;
      setBankError(failures > 0 && loaded.length === 0);
      setPartialError(failures > 0 && loaded.length > 0);
      setTopics(loaded);
    });
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
  if (!topics) return <p role="status" className="text-sm text-slate-600">{isBasque ? 'Gaiak kargatzen…' : 'Cargando temas…'}</p>;
  if (!topics.length) return <p className="text-sm text-slate-600">{isBasque ? 'Oposizio honek ez du gai ofizialik esleituta.' : 'Esta oposición aún no tiene preguntas agrupadas por temas oficiales.'}</p>;

  const scopeLabel = (scope: SyllabusType) => scope === 'common'
    ? (isBasque ? 'Gai-zerrenda orokorra' : 'Temario común')
    : (isBasque ? 'Gai-zerrenda espezifikoa' : 'Temario específico');
  const availableScopes = (['common', 'specific'] as const).filter(scope => topics.some(topic => topic.scope === scope));
  const activeScope = availableScopes.includes(selectedScope) ? selectedScope : availableScopes[0];
  const scopeTopics = topics.filter(topic => topic.scope === activeScope);
  const startTopic = (questions: Question[], topic: TopicPracticeContext, scope: SyllabusType) => {
    const prefix = scope === 'common' ? 'Temas · Común' : 'Temas';
    onStart(orderTopicQuestions(questions, topic.randomize), `${prefix} · ${topic.label}`, topic);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-900 p-5 text-white">
        <h4 className="flex items-center gap-2 text-lg font-black"><Zap size={20} className="text-amber-300" aria-hidden="true" />{isBasque ? 'Gaien energia' : 'Energía por temas'}</h4>
        <p className="mt-2 text-sm text-indigo-100">{isBasque ? 'Energia galdera bakoitzeko azken hiru erantzunek ematen dute. Sakatu gai bat proba osoa hasteko.' : 'La energía refleja tus aciertos en las últimas tres respuestas de cada pregunta. Toca un tema para hacer el test completo.'}</p>
      </div>
      <label className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-800">
        {isBasque ? 'Galderen ordena' : 'Orden de las preguntas'}
        <select value={randomize ? 'random' : 'sequence'} onChange={event => onRandomizeChange(event.target.value === 'random')}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
          <option value="sequence">{isBasque ? 'Ordenan' : 'En orden'}</option>
          <option value="random">{isBasque ? 'Ausaz' : 'Aleatorio'}</option>
        </select>
      </label>
      {energyError ? <p role="status" className="text-sm text-rose-700">{isBasque ? 'Ezin izan da energia kargatu.' : 'No se ha podido cargar la energía. Puedes hacer los tests igualmente.'}</p>
        : userId && (syncing || !energy) ? <p role="status" className="text-sm text-slate-600">{isBasque ? 'Energia eguneratzen…' : 'Actualizando energía…'}</p> : null}
      {partialError && <p role="alert" className="text-sm text-rose-700">{isBasque ? 'Ezin izan dira gai-zerrenda guztiak kargatu.' : 'No se ha podido cargar uno de los temarios. Puedes practicar los temas disponibles.'}</p>}
      {availableScopes.length > 1 && <div role="group" aria-label={isBasque ? 'Gai-zerrenda' : 'Temario'} className="grid grid-cols-2 gap-2">
        {availableScopes.map(scope => {
          const entries = topics.filter(topic => topic.scope === scope);
          const count = entries.reduce((sum, topic) => sum + topic.questions.length, 0);
          const styles = scopeStyles[scope];
          return <button key={scope} type="button" aria-pressed={activeScope === scope}
            onClick={() => { setSelectedScope(scope); setOpenTopic(null); }}
            className={`min-h-11 rounded-xl border-2 px-3 py-3 text-left text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 ${styles.focus} ${activeScope === scope ? styles.selected : styles.idle}`}>
            <span className="flex items-center gap-2"><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${styles.dot}`} />{scopeLabel(scope)}</span>
            <span className="block text-xs font-medium">{entries.length} {isBasque ? 'gai' : 'temas'} · {count} {isBasque ? 'galdera' : 'preguntas'}</span>
          </button>;
        })}
      </div>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {scopeTopics.map((entry, index) => {
          const { label, questions, scope } = entry;
          const styles = scopeStyles[scope];
          const key = topicKey(entry);
          const detailId = `topic-details-${scope}-${index}`;
          const topic = { label, questions, randomize };
          const progress = energy && !energyError ? summarizeTopicEnergy(questions, energy) : null;
          const rate = progress?.rate ?? null;
          const status = rate != null ? `${rate}%` : (energyError || (!energy && userId)) ? '—' : isBasque ? 'Entrenatu gabe' : 'Sin entrenar';
          return (
            <li key={key} className={openTopic === key ? "lg:col-span-2" : undefined}>
              <div className={`relative rounded-2xl border shadow-sm ${styles.card}`}>
              <button type="button" onClick={() => startTopic(questions, topic, scope)}
                className={`group flex h-full w-full items-center gap-3 rounded-2xl p-4 pr-16 text-left transition focus-visible:outline focus-visible:outline-2 motion-reduce:transition-none ${styles.hover} ${styles.focus}`}>
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
                    <span className={`font-bold ${styles.accent}`}>{isBasque ? 'Proba osoa hasi' : 'Hacer test completo'}</span>
                  </span>
                </span>
                <ChevronRight size={20} className={`shrink-0 ${styles.accent}`} aria-hidden="true" />
              </button>
                <button type="button" aria-expanded={openTopic === key}
                  aria-controls={openTopic === key ? detailId : undefined}
                  aria-label={isBasque ? `${label}: galderen xehetasunak` : `${label}: detalle de las preguntas`}
                  onClick={() => setOpenTopic(current => current === key ? null : key)}
                  className={`absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full border bg-white focus-visible:outline focus-visible:outline-2 ${styles.info} ${styles.focus}`}>
                  <Info size={18} aria-hidden="true" />
                </button>
              </div>
              {openTopic === key && <div id={detailId} className="mt-2">
                <TopicQuestionBattery questions={questions} energy={energyError ? null : energy} isBasque={isBasque}
                  onStart={selected => onStart(orderTopicQuestions(selected, randomize), `Temas · ${scope === 'common' ? 'Común · ' : ''}Más falladas · ${label}`, topic)} />
              </div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
