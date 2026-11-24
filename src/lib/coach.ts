import type {
  CoachPrimaryAction,
  ExecutableSessionPlan,
  PracticeExamTarget,
  PracticeLearningDashboard,
  PracticeLearningDashboardV2,
  PracticeMode,
  PracticePressureInsights,
  PracticePressureInsightsV2,
  PracticeSessionSummary,
  SyllabusType,
} from '../types';

export type CoachPlanV2 = {
  primaryAction: CoachPrimaryAction;
  intensity: 'low' | 'medium' | 'high';
  duration: 'short' | 'normal' | 'long';
  tone: 'rescue' | 'protect' | 'build' | 'push' | 'maintain';
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  reasons: string[];
  evidence: {
    dominantProblem: string;
    supportingSignals: string[];
  };
  sessionSpec: {
    targetQuestions?: number;
    targetMinutes?: number;
    allowedDifficulty?: 'easy_only' | 'mixed' | 'hard_bias';
    focusScope?: 'weak_only' | 'mixed' | 'pressure' | 'full_exam';
  };
  decisionMeta?: {
    actionBeforeGrayZone?: string | null;
    actionAfterGrayZone: string;
    grayZoneTriggered: boolean;
    aggressiveActionDowngraded: boolean;
    safetyTriggeredCount: number;
    safetyTriggeredKeys: string[];
    defaultsUsedCount: number;
    defaultsUsed: string[];
    decisionMargin: number | null;
    signalCompleteness: number;
  };
};

export const coachPrimaryActionToPracticeMode = (primaryAction: CoachPrimaryAction): PracticeMode => {
  switch (primaryAction) {
    case 'push':
    case 'recovery':
      return 'standard';
    default:
      return primaryAction;
  }
};

export const buildExecutableSessionPlanFromCoach = (
  plan: CoachPlanV2,
  context: {
    defaultQuestionCount?: number;
    syllabus?: SyllabusType | null;
    dominantState?: string | null;
  } = {},
): ExecutableSessionPlan => {
  const mode = coachPrimaryActionToPracticeMode(plan.primaryAction);
  const target = typeof plan.sessionSpec.targetQuestions === 'number' && Number.isFinite(plan.sessionSpec.targetQuestions)
    ? Math.max(1, Math.round(plan.sessionSpec.targetQuestions))
    : null;
  const fallback =
    typeof context.defaultQuestionCount === 'number' && Number.isFinite(context.defaultQuestionCount)
      ? Math.max(1, Math.round(context.defaultQuestionCount))
      : null;

  return {
    source: 'coach',
    primaryAction: plan.primaryAction,
    mode,
    syllabus: context.syllabus ?? null,
    questionCount: target ?? fallback,
    tone: plan.tone,
    confidence: plan.confidence,
    reasons: plan.reasons,
    dominantState: context.dominantState ?? null,
  };
};

type BuildCoachPlanV2Input = {
  learningDashboard: PracticeLearningDashboard | null;
  learningDashboardV2?: PracticeLearningDashboardV2 | null;
  pressureInsights: PracticePressureInsights | null;
  pressureInsightsV2?: PracticePressureInsightsV2 | null;
  examTarget: PracticeExamTarget | null;
  recentSessions: PracticeSessionSummary[];
  recommendedBatchNumber: number;
  totalBatches: number;
  batchSize: number;
  locale?: 'es' | 'eu';
};

export type CoachTwoLineMessage = {
  line1: string;
  line2: string;
  text: string;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const normalize100 = (value: number, max: number) =>
  !Number.isFinite(value) || max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
const formatPercent = (value: number | null | undefined) =>
  `${Math.round(clamp01(value ?? 0) * 100)}%`;

const createDefaultRecorder = () => {
  const set = new Set<string>();
  const list: string[] = [];
  return {
    add: (key: string) => {
      if (!key || set.has(key)) return;
      set.add(key);
      list.push(key);
    },
    values: () => [...list],
    count: () => list.length,
  };
};

const getDaysToExam = (examDate: string | null | undefined, referenceDate: Date) => {
  if (!examDate) return null;
  const exam = new Date(examDate);
  if (Number.isNaN(exam.getTime())) return null;
  const diffMs = exam.getTime() - referenceDate.getTime();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
};

const toSessionTimestamp = (session: PracticeSessionSummary) => {
  const raw = session.finishedAt || session.startedAt;
  const timestamp = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(timestamp) ? timestamp : -Infinity;
};

const sortSessionsMostRecentFirst = (recentSessions: PracticeSessionSummary[]) =>
  [...recentSessions].sort((left, right) => toSessionTimestamp(right) - toSessionTimestamp(left));

const computeAccuracyRecent = (recentSessions: PracticeSessionSummary[]) => {
  const windowSessions = sortSessionsMostRecentFirst(recentSessions).slice(0, 3);
  const totals = windowSessions.reduce(
    (acc, session) => {
      acc.score += Number(session.score ?? 0) || 0;
      acc.total += Number(session.total ?? 0) || 0;
      return acc;
    },
    { score: 0, total: 0 },
  );
  if (totals.total <= 0) return null;
  return clamp01(totals.score / totals.total);
};

const computeDaysSinceLastSession = (recentSessions: PracticeSessionSummary[], referenceDate: Date) => {
  const last = sortSessionsMostRecentFirst(recentSessions)[0];
  const raw = last?.finishedAt || last?.startedAt;
  if (!raw) return null;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) return null;
  return Math.max(0, Math.floor((referenceDate.getTime() - timestamp.getTime()) / 86_400_000));
};

const getSafetyTriggeredKeys = (safety: {
  forbidHighIntensity: boolean;
  forbidSimulacro: boolean;
  preferShort: boolean;
  avoidPressureFirst: boolean;
}) => {
  const keys: string[] = [];
  if (safety.forbidSimulacro) keys.push('forbidSimulacro');
  if (safety.avoidPressureFirst) keys.push('avoidPressureFirst');
  if (safety.forbidHighIntensity) keys.push('capHighIntensityForFatigue');
  if (safety.preferShort) keys.push('preferShortSession');
  return keys;
};

const estimateConfidence = ({
  signalCompleteness,
  decisionMargin,
  defaultsUsedCount,
  safetyTriggeredCount,
  isGrayZone,
}: {
  signalCompleteness: number;
  decisionMargin: number;
  defaultsUsedCount: number;
  safetyTriggeredCount: number;
  isGrayZone: boolean;
}) => {
  const completeness = clamp01(signalCompleteness);
  const margin = clamp01(decisionMargin);
  let confidence = 0.22 + 0.58 * completeness + 0.35 * margin;
  confidence -= 0.07 * defaultsUsedCount;
  confidence -= 0.05 * safetyTriggeredCount;
  if (isGrayZone) confidence -= 0.14;
  if (margin < 0.03) confidence = Math.min(confidence, 0.46);
  if (completeness < 0.35) confidence = Math.min(confidence, 0.52);
  return clamp01(confidence);
};

const buildReasons = ({
  primaryAction,
  signals,
  safety,
  isGrayZone,
  locale = 'es',
}: {
  primaryAction: CoachPlanV2['primaryAction'];
  signals: {
    accuracyRecent: number | null;
    backlogOverdue: number;
    backlogPressure: number;
    daysSinceLastSession: number | null;
    pressureGap: number | null;
  };
  safety: {
    forbidHighIntensity: boolean;
    forbidSimulacro: boolean;
    preferShort: boolean;
    avoidPressureFirst: boolean;
  };
  isGrayZone: boolean;
  locale?: 'es' | 'eu';
}) => {
  const isBasque = locale === 'eu';
  const reasons: string[] = [];
  if (isGrayZone) {
    reasons.push(
      isBasque
        ? 'Seinalea oraindik ez da guztiz argia, eta gaur erabaki zuhurra komeni da.'
        : 'La señal aún no es nítida y hoy conviene una decisión conservadora.',
    );
  }
  if (safety.avoidPressureFirst) {
    reasons.push(
      isBasque
        ? 'Oinarria oraindik ez dago nahikoa egonkor simulakroan kalitatez sartzeko.'
        : 'La base todavía no es estable para entrar a simulacro con calidad.',
    );
  }
  if (signals.backlogPressure >= 55 || signals.backlogOverdue >= 10) {
    reasons.push(
      isBasque
        ? 'Pilatutako errepaso nahikoa dago estutu aurretik sendotzeko.'
        : 'Hay repaso vencido suficiente como para consolidar antes de apretar.',
    );
  }
  if (signals.daysSinceLastSession !== null && signals.daysSinceLastSession >= 3) {
    reasons.push(
      isBasque
        ? 'Hainbat egun saiorik gabe egon ondoren, berrartze labur batek etekin hobea ematen du.'
        : 'Tras varios días sin sesión, una reentrada corta tiene mejor retorno.',
    );
  }
  if (signals.pressureGap !== null && signals.pressureGap >= 0.12 && primaryAction !== 'simulacro') {
    reasons.push(
      isBasque
        ? 'Presiopean aldea badago, baina gaur hobe da lehenengo egonkortzea.'
        : 'La brecha bajo presión existe, pero hoy va mejor estabilizar primero.',
    );
  }
  if (signals.accuracyRecent !== null && signals.accuracyRecent < 0.55) {
    reasons.push(
      isBasque
        ? 'Azken asmatze-tasa baxua da eta exijentzia igo aurretik zarata kentzea komeni da.'
        : 'El acierto reciente es bajo y conviene quitar ruido antes de subir exigencia.',
    );
  }
  if (safety.forbidHighIntensity) {
    reasons.push(
      isBasque
        ? 'Intentsitatea murrizten da neke-arriskua agertzen delako.'
        : 'La intensidad se recorta porque aparece riesgo de fatiga.',
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      isBasque
        ? 'Seinaleek hurrengo saio argi eta egingarria ahalbidetzen dute.'
        : 'Las señales permiten una siguiente sesión clara y ejecutable.',
    );
  }
  return reasons.slice(0, 4);
};

const buildSessionSpec = (
  primaryAction: CoachPlanV2['primaryAction'],
  intensity: CoachPlanV2['intensity'],
  duration: CoachPlanV2['duration'],
): CoachPlanV2['sessionSpec'] => {
  const baseByAction: Record<CoachPlanV2['primaryAction'], CoachPlanV2['sessionSpec']> = {
    review: { targetQuestions: 20, targetMinutes: 25, allowedDifficulty: 'mixed', focusScope: 'weak_only' },
    recovery: { targetQuestions: 10, targetMinutes: 12, allowedDifficulty: 'easy_only', focusScope: 'mixed' },
    anti_trap: { targetQuestions: 20, targetMinutes: 25, allowedDifficulty: 'mixed', focusScope: 'mixed' },
    simulacro: { targetQuestions: 60, targetMinutes: 75, allowedDifficulty: 'hard_bias', focusScope: 'full_exam' },
    push: { targetQuestions: 20, targetMinutes: 20, allowedDifficulty: 'hard_bias', focusScope: 'mixed' },
    standard: { targetQuestions: 20, targetMinutes: 20, allowedDifficulty: 'mixed', focusScope: 'mixed' },
  };

  const base = { ...baseByAction[primaryAction] };
  if (duration === 'short') {
    base.targetQuestions = Math.min(base.targetQuestions ?? 20, 10);
    base.targetMinutes = Math.min(base.targetMinutes ?? 20, 12);
  } else if (duration === 'long') {
    base.targetQuestions = Math.max(base.targetQuestions ?? 20, 40);
    base.targetMinutes = Math.max(base.targetMinutes ?? 20, 50);
  }
  if (intensity === 'low') base.allowedDifficulty = 'easy_only';
  return base;
};

export const buildCoachPlanV2 = (
  input: BuildCoachPlanV2Input,
  referenceDate = new Date(),
): CoachPlanV2 => {
  const {
    learningDashboard,
    learningDashboardV2,
    pressureInsights,
    pressureInsightsV2,
    examTarget,
    recentSessions,
  } = input;

  const accuracyRecent = computeAccuracyRecent(recentSessions);
  const daysSinceLastSession = computeDaysSinceLastSession(recentSessions, referenceDate);
  const defaults = createDefaultRecorder();

  const readinessScore = normalize100(learningDashboard?.readiness ?? 0, 1);
  const backlogOverdue =
    (learningDashboardV2?.backlogOverdueCount ?? learningDashboard?.overdueCount ?? 0) || 0;
  const dailyReviewCapacity = learningDashboard?.dailyReviewCapacity ?? 35;
  const backlogPressure = Math.max(
    0,
    Math.min(100, normalize100(backlogOverdue, Math.max(1, dailyReviewCapacity * 2))),
  );
  const pressureGap = pressureInsightsV2?.pressureGapRaw ?? pressureInsights?.pressureGap ?? null;
  const fatigue =
    pressureInsightsV2?.avgSimulacroFatigue ?? pressureInsights?.avgSimulacroFatigue ?? null;
  const examDays = getDaysToExam(examTarget?.examDate ?? learningDashboard?.examDate, referenceDate);
  const examProximity = examDays === null ? 0 : Math.max(0, Math.min(1, (60 - examDays) / 60));

  const inactivitySignal =
    daysSinceLastSession === null ? 0 : daysSinceLastSession >= 3 ? 1 : daysSinceLastSession / 3;
  const fatigueRisk = fatigue === null ? 0.35 : clamp01(fatigue);
  if (fatigue === null) defaults.add('fatigueRisk:baseline');
  if (accuracyRecent === null) defaults.add('accuracyRecent:none');
  if (daysSinceLastSession === null) defaults.add('daysSinceLastSession:none');
  if (pressureGap === null || pressureGap === undefined) defaults.add('pressureGap:none');
  if (examDays === null) defaults.add('examProximity:none');
  if (!learningDashboard) defaults.add('learningDashboard:none');
  if (!learningDashboardV2) defaults.add('learningDashboardV2:none');

  const frustrationRisk = clamp01(
    (accuracyRecent !== null ? 0.65 - accuracyRecent : 0.1) +
      (pressureGap ?? 0) * 0.6 +
      fatigueRisk * 0.4,
  );

  const recoveryNeed = clamp01(0.45 * inactivitySignal + 0.35 * fatigueRisk + 0.2 * frustrationRisk);
  const consolidationNeed = clamp01(
    0.55 * (backlogPressure / 100) + 0.45 * (accuracyRecent !== null ? 1 - accuracyRecent : 0.3),
  );
  const pressureNeed = clamp01(0.65 * (pressureGap ?? 0) + 0.35 * examProximity);
  const growthOpportunity = clamp01(
    0.45 * (readinessScore / 100) + 0.35 * (accuracyRecent ?? 0.55) - 0.2 * fatigueRisk,
  );

  const safety = {
    forbidHighIntensity: fatigueRisk > 0.75,
    forbidSimulacro: (daysSinceLastSession ?? 0) >= 3 && examProximity < 0.85,
    preferShort: recoveryNeed > 0.6 || fatigueRisk > 0.7,
    avoidPressureFirst: (pressureGap ?? 0) > 0.14 && (accuracyRecent ?? 0.6) < 0.55,
  };
  const safetyTriggeredKeys = getSafetyTriggeredKeys(safety);

  const candidates = [
    { kind: 'recovery' as const, score: recoveryNeed },
    { kind: 'review' as const, score: consolidationNeed },
    { kind: 'anti_trap' as const, score: (pressureGap ?? 0) * 0.6 + (accuracyRecent ?? 0.6) * 0.2 },
    { kind: 'simulacro' as const, score: pressureNeed },
    { kind: 'push' as const, score: growthOpportunity },
    { kind: 'standard' as const, score: 0.35 },
  ].sort((left, right) => right.score - left.score);

  const top1 = candidates[0] ?? { kind: 'standard' as const, score: 0.35 };
  const top2 = candidates[1] ?? { kind: 'standard' as const, score: 0.35 };
  const decisionMargin = clamp01(top1.score - top2.score);
  const isGrayZone = decisionMargin < 0.06;

  const actionBeforeGrayZone = top1.kind;
  let primaryAction = actionBeforeGrayZone;
  if (primaryAction === 'simulacro' && safety.forbidSimulacro) primaryAction = 'standard';
  if (primaryAction === 'simulacro' && safety.avoidPressureFirst) primaryAction = 'review';

  let aggressiveActionDowngraded = false;
  if (isGrayZone && (primaryAction === 'simulacro' || primaryAction === 'push')) {
    primaryAction = consolidationNeed >= recoveryNeed ? 'review' : 'standard';
    aggressiveActionDowngraded = true;
  }

  let intensity: CoachPlanV2['intensity'] = 'medium';
  if (safety.forbidHighIntensity || recoveryNeed > 0.6) intensity = 'low';
  else if (examProximity > 0.7 && growthOpportunity > 0.6 && fatigueRisk < 0.35) intensity = 'high';

  let duration: CoachPlanV2['duration'] = 'normal';
  if (safety.preferShort) duration = 'short';
  else if (primaryAction === 'simulacro' && intensity !== 'low' && fatigueRisk < 0.45) duration = 'long';

  const tone: CoachPlanV2['tone'] =
    primaryAction === 'recovery'
      ? 'rescue'
      : primaryAction === 'review' || primaryAction === 'anti_trap'
        ? 'build'
        : primaryAction === 'push'
          ? 'push'
          : 'maintain';

  const urgencyRaw = clamp01(
    0.45 * (backlogPressure / 100) + 0.35 * examProximity + 0.2 * inactivitySignal,
  );
  const urgency: CoachPlanV2['urgency'] =
    urgencyRaw > 0.72 ? 'high' : urgencyRaw > 0.42 ? 'medium' : 'low';

  const signalCount =
    Number(accuracyRecent !== null) +
    Number(daysSinceLastSession !== null) +
    Number(pressureGap !== null && pressureGap !== undefined) +
    Number(Boolean(examTarget?.examDate ?? learningDashboard?.examDate)) +
    Number(learningDashboard !== null);
  const signalCompleteness = signalCount / 5;
  const defaultsUsed = defaults.values();

  const locale = input.locale ?? 'es';
  const isBasque = locale === 'eu';

  const supportingSignals: string[] = [];
  if (daysSinceLastSession !== null && daysSinceLastSession > 0) {
    supportingSignals.push(
      isBasque
        ? `Azken saioa duela ${daysSinceLastSession} egun`
        : `Última sesión hace ${daysSinceLastSession}d`,
    );
  }
  if (accuracyRecent !== null) {
    supportingSignals.push(
      isBasque
        ? `Azken asmatzea ${formatPercent(accuracyRecent)}`
        : `Acierto reciente ${formatPercent(accuracyRecent)}`,
    );
  }
  if (pressureGap !== null && pressureGap !== undefined) {
    supportingSignals.push(
      isBasque
        ? `Presio-aldea ${Math.round(Math.abs(pressureGap) * 100)} pt`
        : `Brecha de presión ${Math.round(Math.abs(pressureGap) * 100)} pts`,
    );
  }
  if (backlogOverdue > 0) {
    supportingSignals.push(
      isBasque
        ? `Premiazko errepasoak ${backlogOverdue}`
        : `Repasos urgentes ${backlogOverdue}`,
    );
  }

  return {
    primaryAction,
    intensity,
    duration,
    tone,
    urgency,
    confidence: estimateConfidence({
      signalCompleteness,
      decisionMargin,
      defaultsUsedCount: defaults.count(),
      safetyTriggeredCount: safetyTriggeredKeys.length,
      isGrayZone,
    }),
    reasons: buildReasons({
      primaryAction,
      signals: {
        accuracyRecent,
        backlogOverdue,
        backlogPressure,
        daysSinceLastSession,
        pressureGap: pressureGap ?? null,
      },
      safety,
      isGrayZone,
      locale,
    }),
    evidence: {
      dominantProblem:
        primaryAction === 'recovery'
          ? isBasque
            ? 'Erritmo-galera'
            : 'Pérdida de ritmo'
          : primaryAction === 'review'
            ? isBasque
              ? 'Oinarrian zorra'
              : 'Base con deuda'
            : primaryAction === 'anti_trap'
              ? isBasque
                ? 'Irakurketa-akatsak'
                : 'Errores de lectura'
              : primaryAction === 'simulacro'
                ? isBasque
                  ? 'Azterketa-presioa'
                  : 'Presión de examen'
                : primaryAction === 'push'
                  ? isBasque
                    ? 'Une aprobetxagarria'
                    : 'Momento aprovechable'
                  : isBasque
                    ? 'Jarraitutasuna'
                    : 'Continuidad',
      supportingSignals: supportingSignals.slice(0, 4),
    },
    sessionSpec: buildSessionSpec(primaryAction, intensity, duration),
    decisionMeta: {
      actionBeforeGrayZone: aggressiveActionDowngraded ? actionBeforeGrayZone : null,
      actionAfterGrayZone: primaryAction,
      grayZoneTriggered: isGrayZone,
      aggressiveActionDowngraded,
      safetyTriggeredCount: safetyTriggeredKeys.length,
      safetyTriggeredKeys,
      defaultsUsedCount: defaultsUsed.length,
      defaultsUsed,
      decisionMargin,
      signalCompleteness,
    },
  };
};

export const buildCoachTwoLineMessageV2 = (
  planV2: CoachPlanV2,
  localeOrOptions:
    | 'es'
    | 'eu'
    | {
        contextLabel?: string;
        locale?: 'es' | 'eu';
      } = 'es',
): CoachTwoLineMessage => {
  const locale =
    typeof localeOrOptions === 'string'
      ? localeOrOptions
      : localeOrOptions?.locale ?? 'es';
  const isBasque = locale === 'eu';
  switch (planV2.primaryAction) {
    case 'review': {
      const line1 = isBasque ? 'Errepaso errentagarria duzu aurrean.' : 'Tienes repaso rentable delante.';
      const line2 = isBasque
        ? 'Gaur hobe da aurrera egin aurretik sendotzea.'
        : 'Hoy va mejor consolidar antes de seguir.';
      return { line1, line2, text: `${line1} ${line2}` };
    }
    case 'recovery': {
      const line1 = isBasque
        ? 'Gaur garrantzitsuena berriro martxan jartzea da.'
        : 'Lo importante hoy es volver a entrar.';
      const line2 = isBasque
        ? 'Saio labur batek dinamika aldatzen du.'
        : 'Una sesión corta ya cambia la dinámica.';
      return { line1, line2, text: `${line1} ${line2}` };
    }
    case 'simulacro': {
      const line1 = isBasque
        ? 'Azterketa-baldintzetan neurtzeko unea da.'
        : 'Toca medirte en condiciones de examen.';
      const line2 = isBasque
        ? 'Benetako argazkiak presioa eta itxiera osoa behar ditu.'
        : 'La foto real necesita presión y cierre completo.';
      return { line1, line2, text: `${line1} ${line2}` };
    }
    case 'anti_trap': {
      const line1 = isBasque
        ? 'Irakurketa-akatsak pisua hartzen ari dira.'
        : 'Están pesando errores de lectura.';
      const line2 = isBasque
        ? 'Gaur hobe da tranpak fintzea zabaldu aurretik.'
        : 'Hoy va mejor afinar trampas antes de ampliar.';
      return { line1, line2, text: `${line1} ${line2}` };
    }
    case 'push': {
      const line1 = isBasque
        ? 'Zure oinarriak martxa bat gehiago eusten du.'
        : 'Tu base aguanta una marcha más.';
      const line2 = isBasque
        ? 'Gaur exijentzia kontrolpean igo dezakezu.'
        : 'Hoy puedes subir exigencia con control.';
      return { line1, line2, text: `${line1} ${line2}` };
    }
    default: {
      const line1 = isBasque ? 'Hurrengo saio argi bat duzu.' : 'Hay una siguiente sesión clara.';
      const line2 = isBasque
        ? 'Gaur jarraitutasuna eta seinalea mantentzea komeni da.'
        : 'Hoy conviene mantener continuidad y señal.';
      return { line1, line2, text: `${line1} ${line2}` };
    }
  }
};
