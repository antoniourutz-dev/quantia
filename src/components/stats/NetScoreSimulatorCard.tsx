import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, RotateCcw, Scale, Sparkles, Target, TrendingUp } from 'lucide-react';
import type { PracticeLawPerformance, SyllabusType } from '../../types';
import { useAppLocale } from '../../lib/locale';
import type { TopicInsightItem } from '../../lib/statsInsights';
import {
  buildTopicRoiPriorities,
  formatNetScore,
  PENALTY_RULE_ORDER,
  PENALTY_RULES,
  simulateExamNetScore,
  type PenaltyRuleId,
  type TopicRoiReason,
} from '../../lib/netScore';

interface NetScoreSimulatorCardProps {
  penaltyRule: PenaltyRuleId;
  onChangePenaltyRule?: (rule: PenaltyRuleId) => void;
  readinessPct: number;
  observedAccuracyPct: number;
  topicInsights: TopicInsightItem[];
  lawBreakdown: PracticeLawPerformance[];
  singleScope: boolean;
  lawCurriculum: boolean;
  onPracticeTopic?: (topicLabel: string, scope: SyllabusType) => void;
  onPracticeLaw?: (lawReference: string) => void;
}

const EXAM_LENGTH_PRESETS = [50, 80, 100] as const;

const mapLawBreakdownToTopicInsights = (
  laws: PracticeLawPerformance[],
): TopicInsightItem[] =>
  laws
    .filter((law) => Boolean(law.ley_referencia))
    .map((law) => {
      const questionCount = Math.max(1, law.questionCount ?? law.attempts ?? 1);
      const consolidatedCount = Math.min(
        questionCount,
        Math.max(0, law.consolidatedCount ?? 0),
      );
      const seenCount = Math.min(
        questionCount,
        Math.max(consolidatedCount, law.attempts > 0 ? Math.min(questionCount, law.attempts) : 0),
      );
      const unseenCount = Math.max(0, questionCount - seenCount);
      const coveragePct = Math.round((seenCount / questionCount) * 100);
      const accuracyPct =
        law.attempts > 0 ? Math.round(law.accuracyRate * 100) : null;
      const fragileCount = Math.max(0, seenCount - consolidatedCount);
      const scope: SyllabusType = law.scope === 'common' ? 'common' : 'specific';

      return {
        id: law.lawId ?? law.ley_referencia,
        label: law.ley_referencia,
        scope,
        questionCount,
        seenCount,
        unseenCount,
        coveragePct,
        attempts: law.attempts,
        accuracyPct,
        deltaPp: null,
        checkpoints: [],
        fragileCount,
        consolidatingCount: 0,
        solidCount: consolidatedCount,
        masteredCount: 0,
        excessRiskPct: null,
        status:
          coveragePct < 35
            ? 'unexplored'
            : (accuracyPct ?? 0) < 70
              ? 'risk'
              : 'solid',
      };
    });

export default function NetScoreSimulatorCard({
  penaltyRule,
  onChangePenaltyRule,
  readinessPct,
  observedAccuracyPct,
  topicInsights,
  lawBreakdown,
  singleScope,
  lawCurriculum,
  onPracticeTopic,
  onPracticeLaw,
}: NetScoreSimulatorCardProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = useCallback((es: string, eu: string) => (isBasque ? eu : es), [isBasque]);

  const [activePenaltyRule, setActivePenaltyRule] = useState<PenaltyRuleId>(penaltyRule);
  const [examQuestions, setExamQuestions] = useState<number>(100);
  const [targetScoreBase10, setTargetScoreBase10] = useState<number>(6.5);
  const [answerRatePct, setAnswerRatePct] = useState<number>(100);
  const [accuracyOverride, setAccuracyOverride] = useState<number | null>(null);

  useEffect(() => {
    setActivePenaltyRule(penaltyRule);
  }, [penaltyRule]);

  const baseAccuracyPct = Math.min(
    100,
    Math.max(0, readinessPct > 0 ? readinessPct : observedAccuracyPct),
  );
  const effectiveAccuracyPct = accuracyOverride ?? baseAccuracyPct;

  const handleSelectRule = (nextRule: PenaltyRuleId) => {
    setActivePenaltyRule(nextRule);
    onChangePenaltyRule?.(nextRule);
  };

  const simulation = useMemo(
    () =>
      simulateExamNetScore({
        examQuestions,
        accuracyRate: effectiveAccuracyPct / 100,
        answerRate: answerRatePct / 100,
        penaltyRule: activePenaltyRule,
        targetScoreBase10,
      }),
    [activePenaltyRule, answerRatePct, effectiveAccuracyPct, examQuestions, targetScoreBase10],
  );

  const usingLawFallback = topicInsights.length === 0 && lawBreakdown.length > 0;

  const roiTopics = useMemo(() => {
    const sourceTopics = usingLawFallback
      ? mapLawBreakdownToTopicInsights(lawBreakdown)
      : topicInsights;
    return buildTopicRoiPriorities({
      topics: sourceTopics,
      penaltyRule: activePenaltyRule,
      limit: 5,
    });
  }, [activePenaltyRule, lawBreakdown, topicInsights, usingLawFallback]);

  const reasonLabel = (reason: TopicRoiReason) => {
    switch (reason) {
      case 'unexplored_weight':
        return t('Sin explorar', 'Arakatu gabe');
      case 'fragile_cleanup':
        return t('Limpiar frágiles', 'Hauskorrak garbitu');
      case 'high_error_weight':
      default:
        return t('Alto peso y fallos', 'Pisu handia eta hutsak');
    }
  };

  const reasonTone = (reason: TopicRoiReason) => {
    switch (reason) {
      case 'unexplored_weight':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'fragile_cleanup':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'high_error_weight':
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  const scoreTone =
    simulation.scoreBase10 >= 7
      ? 'text-emerald-600'
      : simulation.scoreBase10 >= 5
        ? 'text-amber-600'
        : 'text-rose-600';

  const canPracticeRoi = usingLawFallback
    ? Boolean(onPracticeLaw || onPracticeTopic)
    : Boolean(onPracticeTopic);

  return (
    <section
      aria-label={t('Simulador de nota neta y priorizador ROI', 'Nota garbiaren simulatzailea eta ROI lehenetsia')}
      className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600">
            <Scale size={14} />
            {t('Nota neta y retorno de estudio', 'Nota garbia eta ikasketa-errendimendua')}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {t('Simulador de Nota Neta + Priorizador ROI', 'Nota Garbiaren Simulatzailea + ROI Lehenetsia')}
          </h2>
          <p className="text-sm font-medium text-slate-500">
            {t(
              'Proyecta tu nota sobre 10 según penalización y descubre qué 5 temas te dan más puntos por hora.',
              'Proiektatu zure 10 gaineko nota zigorraren arabera eta ikusi zein 5 gaik ematen dizuten puntu gehien.',
            )}
          </p>
        </div>

        {/* Segmented penalty rule selector */}
        <div
          role="radiogroup"
          aria-label={t('Regla de penalización del simulador', 'Simulatzailearen zigor-araua')}
          className="inline-flex self-start rounded-2xl border border-slate-200 bg-slate-50 p-1"
        >
          {PENALTY_RULE_ORDER.map((ruleId) => {
            const meta = PENALTY_RULES[ruleId];
            const active = activePenaltyRule === ruleId;
            return (
              <button
                key={ruleId}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleSelectRule(ruleId)}
                className={`rounded-xl px-3.5 py-2 text-xs font-black tabular-nums transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {meta.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* LEFT: SIMULADOR DE NOTA NETA */}
        <div className="xl:col-span-6 rounded-3xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-5">
          {/* Top projection readout */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {t('Nota neta proyectada', 'Proiektatutako nota garbia')}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-3xl sm:text-4xl font-black tabular-nums ${scoreTone}`}>
                    {formatNetScore(simulation.scoreBase10)}
                  </span>
                  <span className="text-sm font-black text-slate-400">/ 10</span>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black tabular-nums ${
                  simulation.meetsTarget
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                <Target size={13} />
                {simulation.gapBase10 >= 0 ? '+' : ''}
                {formatNetScore(simulation.gapBase10)}{' '}
                {t(`vs objetivo (${formatNetScore(targetScoreBase10, 1)})`, `helburuaren aldean (${formatNetScore(targetScoreBase10, 1)})`)}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {t('Aciertos', 'Zuzenak')}
                </div>
                <div className="text-sm font-black text-emerald-600 tabular-nums">
                  {formatNetScore(simulation.expectedCorrect, 1)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {t('Fallos', 'Hutsak')}
                </div>
                <div className="text-sm font-black text-rose-600 tabular-nums">
                  {formatNetScore(simulation.expectedIncorrect, 1)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {t('En blanco', 'Zuri')}
                </div>
                <div className="text-sm font-black text-slate-700 tabular-nums">
                  {formatNetScore(simulation.blankCount, 0)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {t('Penalización', 'Zigorra')}
                </div>
                <div className="text-sm font-black text-amber-700 tabular-nums">
                  -{formatNetScore(simulation.penaltyLostBase10)}/10
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs font-semibold text-slate-600">
              <span>{t('Acierto necesario para el objetivo:', 'Helburua lortzeko behar den doitasuna:')}</span>
              <strong className="font-black text-slate-900 tabular-nums">
                {simulation.requiredAccuracyPct != null
                  ? `${simulation.requiredAccuracyPct}%`
                  : t('Imposible con este % respondidas', 'Ezinezkoa erantzun-tasa honekin')}
              </strong>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="space-y-4">
            {/* Exam length presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                {t('Preguntas del examen', 'Azterketako galderak')}
              </span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
                {EXAM_LENGTH_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={examQuestions === preset}
                    onClick={() => setExamQuestions(preset)}
                    className={`rounded-lg px-3 py-1 text-xs font-black tabular-nums transition-colors ${
                      examQuestions === preset
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Target score slider */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>{t('Nota objetivo (sobre 10)', 'Helburu-nota (10etik)')}</span>
                <span className="font-black text-slate-900 tabular-nums">
                  {formatNetScore(targetScoreBase10, 1)} / 10
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={9.5}
                step={0.5}
                value={targetScoreBase10}
                onChange={(e) => setTargetScoreBase10(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </label>

            {/* Answer rate slider */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>{t('Estrategia (% respondidas)', 'Estrategia (% erantzunda)')}</span>
                <span className="font-black text-slate-900 tabular-nums">{answerRatePct}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={answerRatePct}
                onChange={(e) => setAnswerRatePct(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </label>

            {/* Estimated accuracy slider + reset */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
                <label htmlFor="net-score-accuracy-slider">
                  {t('Acierto estimado', 'Aurreikusitako doitasuna')}
                </label>
                <div className="flex items-center gap-2">
                  {accuracyOverride != null ? (
                    <button
                      type="button"
                      onClick={() => setAccuracyOverride(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
                    >
                      <RotateCcw size={11} />
                      {t('Usar mi pulso actual', 'Erabili nire egungo pultsua')}
                    </button>
                  ) : null}
                  <span className="font-black text-slate-900 tabular-nums">
                    {effectiveAccuracyPct}%
                  </span>
                </div>
              </div>
              <input
                id="net-score-accuracy-slider"
                type="range"
                min={25}
                max={100}
                step={1}
                value={effectiveAccuracyPct}
                onChange={(e) => setAccuracyOverride(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          {/* 3-rule mini comparison */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('Comparativa rápida por regla', 'Arauen arteko alderaketa azkarra')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PENALTY_RULE_ORDER.map((ruleId) => {
                const meta = PENALTY_RULES[ruleId];
                const outcome = simulation.byRule[ruleId];
                const isSelected = activePenaltyRule === ruleId;
                return (
                  <button
                    key={ruleId}
                    type="button"
                    onClick={() => handleSelectRule(ruleId)}
                    className={`rounded-2xl border p-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50/70 ring-1 ring-indigo-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-black text-slate-500 tabular-nums">
                      {meta.shortLabel}
                    </div>
                    <div
                      className={`mt-0.5 text-base font-black tabular-nums ${
                        outcome.meetsTarget ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {formatNetScore(outcome.scoreBase10)}/10
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: PRIORIZADOR ROI (TOP 5 TEMAS) */}
        <div className="xl:col-span-6 rounded-3xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  <TrendingUp size={13} />
                  {t('Priorizador ROI · Top 5', 'ROI Lehenetsia · Top 5')}
                </div>
                <h3 className="mt-1 text-base sm:text-lg font-black text-slate-900">
                  {t('Dónde ganar más nota neta ahora', 'Non irabazi nota garbi gehien orain')}
                </h3>
              </div>
              <span className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 tabular-nums">
                {PENALTY_RULES[activePenaltyRule].shortLabel}
              </span>
            </div>

            {roiTopics.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm font-semibold text-emerald-900 flex items-start gap-2.5">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>
                  {t(
                    'Tus temas están por encima del umbral objetivo. Mantén repasos mezclados para sostener tu nota neta.',
                    'Zure gaiak helburu-atalasearen gainetik daude. Jarraitu nahastutako errepasoekin nota garbia mantentzeko.',
                  )}
                </span>
              </div>
            ) : (
              <ol className="space-y-2.5">
                {roiTopics.map((item, index) => (
                  <li
                    key={`${item.scope}:${item.id}`}
                    className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white tabular-nums">
                          {index + 1}
                        </span>
                        <span className="truncate text-sm font-black text-slate-900" title={item.label}>
                          {item.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        {!singleScope && !lawCurriculum && !usingLawFallback ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                            {item.scope === 'common'
                              ? t('Común', 'Arrunta')
                              : t('Específico', 'Espezifikoa')}
                          </span>
                        ) : null}
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 tabular-nums">
                          {item.weightPct}% {t('del temario', 'temariotik')}
                        </span>
                        <span
                          className={`rounded-md border px-2 py-0.5 ${reasonTone(item.reason)}`}
                        >
                          {reasonLabel(item.reason)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {t('Ganancia est.', 'Irabazi est.')}
                        </div>
                        <div className="text-sm font-black text-emerald-700 tabular-nums">
                          +{formatNetScore(item.potentialBase10Gain)} /10
                        </div>
                      </div>

                      {canPracticeRoi ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (usingLawFallback && onPracticeLaw) {
                              onPracticeLaw(item.label);
                            } else {
                              onPracticeTopic?.(item.label, item.scope);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
                        >
                          <Play size={12} />
                          {t('Practicar', 'Praktikatu')}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
            {t(
              'El orden prioriza temas con mayor peso en el banco y mayor mejora potencial en nota neta bajo la penalización seleccionada.',
              'Ordenak bankuan pisu handiena eta aukeratutako zigorrarekin nota garbian hobekuntza potentzial handiena duten gaiak lehenesten ditu.',
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
