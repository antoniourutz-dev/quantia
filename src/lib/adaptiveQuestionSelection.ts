export type AdaptiveQuestion = { id: string };

export type AdaptiveQuestionActivity = {
  questionId: string;
  viewedAt: string;
  isCorrect: boolean | null;
};

export type AdaptiveSelectionProfile = 'adaptive' | 'simulacro';

type QuestionMemory = {
  views: number;
  viewsToday: number;
  correct: number;
  incorrect: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  lastViewedAt: number | null;
  lastResult: boolean | null;
  interveningQuestions: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const localDayStart = (timestamp: number) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const buildMemory = (
  questionIds: string[],
  activity: AdaptiveQuestionActivity[],
  now: number,
) => {
  const validIds = new Set(questionIds);
  const ordered = activity
    .map((event) => ({ ...event, timestamp: Date.parse(event.viewedAt) }))
    .filter((event) => validIds.has(event.questionId) && Number.isFinite(event.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
  const todayStart = localDayStart(now);
  const byQuestion = new Map<string, QuestionMemory>();
  const eventsByQuestion = new Map<string, typeof ordered>();
  const lastIndexByQuestion = new Map<string, number>();
  const distinctQuestionsAfterIndex = new Array<number>(ordered.length).fill(0);
  const seenAfter = new Set<string>();
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    distinctQuestionsAfterIndex[index] = seenAfter.size;
    seenAfter.add(ordered[index].questionId);
  }
  ordered.forEach((event, index) => {
    const events = eventsByQuestion.get(event.questionId) ?? [];
    events.push(event);
    eventsByQuestion.set(event.questionId, events);
    lastIndexByQuestion.set(event.questionId, index);
  });

  for (const questionId of questionIds) {
    const events = eventsByQuestion.get(questionId) ?? [];
    const answered = events.filter((event) => event.isCorrect != null);
    let consecutiveCorrect = 0;
    let consecutiveIncorrect = 0;
    for (let index = answered.length - 1; index >= 0; index -= 1) {
      if (answered[index].isCorrect === true && consecutiveIncorrect === 0) consecutiveCorrect += 1;
      else if (answered[index].isCorrect === false && consecutiveCorrect === 0) consecutiveIncorrect += 1;
      else break;
    }
    const last = events.length > 0 ? events[events.length - 1] : null;
    const lastIndex = last ? lastIndexByQuestion.get(questionId) ?? -1 : -1;
    const interveningQuestions = lastIndex < 0
      ? Number.POSITIVE_INFINITY
      : distinctQuestionsAfterIndex[lastIndex];

    byQuestion.set(questionId, {
      views: events.length,
      viewsToday: events.filter((event) => event.timestamp >= todayStart && event.timestamp <= now).length,
      correct: answered.filter((event) => event.isCorrect === true).length,
      incorrect: answered.filter((event) => event.isCorrect === false).length,
      consecutiveCorrect,
      consecutiveIncorrect,
      lastViewedAt: last?.timestamp ?? null,
      lastResult: answered.length > 0 ? answered[answered.length - 1].isCorrect : null,
      interveningQuestions,
    });
  }

  return byQuestion;
};

const spacingFor = (memory: QuestionMemory) => {
  if (memory.lastResult === false) {
    return memory.consecutiveIncorrect >= 2
      ? { elapsedMs: 10 * MINUTE_MS, intervening: 10 }
      : { elapsedMs: 15 * MINUTE_MS, intervening: 15 };
  }
  if (memory.incorrect > 0 && memory.consecutiveCorrect === 1) {
    return { elapsedMs: 4 * 60 * MINUTE_MS, intervening: 40 };
  }
  if (memory.consecutiveCorrect === 2) {
    return { elapsedMs: DAY_MS, intervening: 80 };
  }
  if (memory.consecutiveCorrect >= 5) return { elapsedMs: 30 * DAY_MS, intervening: 0 };
  if (memory.consecutiveCorrect === 4) return { elapsedMs: 14 * DAY_MS, intervening: 0 };
  if (memory.consecutiveCorrect === 3) return { elapsedMs: 7 * DAY_MS, intervening: 0 };
  return { elapsedMs: DAY_MS, intervening: 40 };
};

export const selectAdaptiveQuestions = <T extends AdaptiveQuestion>(params: {
  questions: T[];
  count: number;
  activity: AdaptiveQuestionActivity[];
  profile?: AdaptiveSelectionProfile;
  now?: number;
  random?: () => number;
}): T[] => {
  const target = Math.min(params.questions.length, Math.max(0, Math.trunc(params.count)));
  if (target === 0) return [];
  const now = params.now ?? Date.now();
  const profile = params.profile ?? 'adaptive';
  const random = params.random ?? Math.random;
  const memory = buildMemory(params.questions.map((question) => question.id), params.activity, now);
  const decorated = params.questions.map((question) => {
    const stats = memory.get(question.id)!;
    const spacing = spacingFor(stats);
    const elapsed = stats.lastViewedAt == null ? Number.POSITIVE_INFINITY : Math.max(0, now - stats.lastViewedAt);
    const dueRatio = Number.isFinite(elapsed) ? Math.min(2, elapsed / Math.max(1, spacing.elapsedMs)) : 2;
    const accuracy = stats.correct + stats.incorrect > 0
      ? stats.correct / (stats.correct + stats.incorrect)
      : 0.5;
    const weakness = Math.min(1, stats.incorrect / 3) * 0.55 + (1 - accuracy) * 0.45;
    const underexposure = 1 / Math.max(1, stats.views);
    const due = elapsed >= spacing.elapsedMs && stats.interveningQuestions >= spacing.intervening;
    const dailyLimit = stats.lastResult === false ? 3 : 2;
    const withinDailyLimit = stats.viewsToday < dailyLimit;
    const score = profile === 'simulacro'
      ? dueRatio * 35 + underexposure * 35 + weakness * 10 + random() * 20
      : weakness * 45 + dueRatio * 30 + underexposure * 15 + random() * 10;
    return {
      question,
      stats,
      score,
      due,
      withinDailyLimit,
      weak: stats.incorrect > 0 && stats.consecutiveCorrect < 3,
      mastered: stats.consecutiveCorrect >= 3 && accuracy >= 0.8,
    };
  });

  const strict = decorated.filter((item) => item.due && item.withinDailyLimit);
  const dailyEligible = decorated.filter((item) => item.withinDailyLimit);
  const selected: typeof decorated = [];
  const selectedIds = new Set<string>();
  const take = (pool: typeof decorated, amount: number, randomOrder = false) => {
    const available = pool.filter((item) => !selectedIds.has(item.question.id));
    const ordered = randomOrder
      ? available.map((item) => ({ item, order: random() })).sort((a, b) => a.order - b.order).map(({ item }) => item)
      : [...available].sort((left, right) => right.score - left.score);
    for (const item of ordered.slice(0, Math.max(0, amount))) {
      selected.push(item);
      selectedIds.add(item.question.id);
    }
  };

  if (profile === 'simulacro') {
    take(strict, target);
  } else {
    take(strict.filter((item) => item.weak), Math.ceil(target * 0.4));
    take(strict.filter((item) => !item.weak && !item.mastered), Math.ceil(target * 0.3));
    take(strict.filter((item) => item.mastered), Math.floor(target * 0.2));
    take(strict, target - selected.length, true);
  }
  take(dailyEligible, target - selected.length);
  take(decorated, target - selected.length);

  return selected.slice(0, target).map((item) => item.question);
};
