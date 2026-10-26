import type { SyllabusType } from '../types';

export type QuestionBlockBankItem = {
  id: string;
  number: number | null;
  scope: SyllabusType;
  text: string;
  dedupeKey?: string | null;
};

export type QuestionBlockAttempt = {
  eventId?: string | null;
  sessionId?: string | null;
  questionId: string | null;
  questionNumber: number | null;
  scope: SyllabusType | null;
  dedupeKey?: string | null;
  isCorrect: boolean | null;
};

export type QuestionBlockPerformance = {
  scope: SyllabusType;
  start: number;
  end: number;
  questionCount: number;
  attemptedQuestionCount: number;
  views: number;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracyRate: number | null;
  questions: QuestionPerformance[];
};

export type QuestionPerformance = {
  id: string;
  number: number;
  text: string;
  views: number;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracyRate: number | null;
};

export type QuestionRankingSort =
  | 'most_viewed'
  | 'least_viewed'
  | 'most_correct'
  | 'most_incorrect';

export const rankQuestionPerformance = (
  blocks: QuestionBlockPerformance[],
  scope: SyllabusType,
  sort: QuestionRankingSort,
): QuestionPerformance[] => {
  const questions = blocks
    .filter((block) => block.scope === scope)
    .flatMap((block) => block.questions);
  const metric = (question: QuestionPerformance) => {
    switch (sort) {
      case 'most_correct':
        return question.correct;
      case 'most_incorrect':
        return question.incorrect;
      case 'least_viewed':
      case 'most_viewed':
      default:
        return question.views;
    }
  };
  const direction = sort === 'least_viewed' ? 1 : -1;

  return [...questions].sort((left, right) => {
    const metricDifference = (metric(left) - metric(right)) * direction;
    if (metricDifference !== 0) return metricDifference;
    if (left.views !== right.views) return right.views - left.views;
    if (left.attempts !== right.attempts) return right.attempts - left.attempts;
    return left.number - right.number || left.id.localeCompare(right.id);
  });
};

export const selectMostFailedQuestionIds = (
  blocks: QuestionBlockPerformance[],
  scope: SyllabusType | 'all',
  limit: number,
): string[] => {
  const questions = blocks
    .filter((block) => scope === 'all' || block.scope === scope)
    .flatMap((block) => block.questions)
    .filter((question) => question.views > 0 && question.incorrect > 0)
    .sort((left, right) => {
      if (left.incorrect !== right.incorrect) return right.incorrect - left.incorrect;
      const leftAccuracy = left.accuracyRate ?? 1;
      const rightAccuracy = right.accuracyRate ?? 1;
      if (leftAccuracy !== rightAccuracy) return leftAccuracy - rightAccuracy;
      if (left.views !== right.views) return right.views - left.views;
      return left.number - right.number || left.id.localeCompare(right.id);
    });

  return questions.slice(0, Math.max(0, Math.trunc(limit))).map((question) => question.id);
};

const toBlockStart = (questionNumber: number) => Math.floor((questionNumber - 1) / 10) * 10 + 1;
const blockKey = (scope: SyllabusType, start: number) => `${scope}:${start}`;

export const buildQuestionBlockPerformance = (
  bank: QuestionBlockBankItem[],
  attempts: QuestionBlockAttempt[],
): QuestionBlockPerformance[] => {
  const bankById = new Map<string, QuestionBlockBankItem>();
  const bankByDedupeKey = new Map<string, QuestionBlockBankItem>();
  const bankByScopeAndNumber = new Map<string, QuestionBlockBankItem>();
  const blocks = new Map<string, QuestionBlockPerformance & { attemptedIds: Set<string> }>();
  const questionStats = new Map<string, QuestionPerformance>();

  const ensureBlock = (scope: SyllabusType, number: number) => {
    const start = toBlockStart(number);
    const key = blockKey(scope, start);
    const existing = blocks.get(key);
    if (existing) return existing;
    const created: QuestionBlockPerformance & { attemptedIds: Set<string> } = {
      scope,
      start,
      end: start + 9,
      questionCount: 0,
      attemptedQuestionCount: 0,
      views: 0,
      attempts: 0,
      correct: 0,
      incorrect: 0,
      accuracyRate: null,
      questions: [],
      attemptedIds: new Set<string>(),
    };
    blocks.set(key, created);
    return created;
  };

  for (const question of bank) {
    const id = String(question.id ?? '').trim();
    if (id) bankById.set(id, question);
    if (question.dedupeKey) bankByDedupeKey.set(question.dedupeKey, question);
    if (question.number == null || question.number < 1) continue;
    const scopeNumberKey = `${question.scope}:${question.number}`;
    if (!bankByScopeAndNumber.has(scopeNumberKey)) bankByScopeAndNumber.set(scopeNumberKey, question);
    ensureBlock(question.scope, question.number).questionCount += 1;
    questionStats.set(question.id, {
      id: question.id,
      number: question.number,
      text: question.text,
      views: 0,
      attempts: 0,
      correct: 0,
      incorrect: 0,
      accuracyRate: null,
    });
  }

  const attemptsByEventId = new Map<string, QuestionBlockAttempt>();
  const attemptsWithoutEventId: QuestionBlockAttempt[] = [];
  for (const attempt of attempts) {
    if (!attempt.eventId) {
      attemptsWithoutEventId.push(attempt);
      continue;
    }
    const existing = attemptsByEventId.get(attempt.eventId);
    if (!existing || (existing.isCorrect == null && attempt.isCorrect != null)) {
      attemptsByEventId.set(attempt.eventId, attempt);
    }
  }

  for (const attempt of [...attemptsByEventId.values(), ...attemptsWithoutEventId]) {
    const matchedQuestion =
      (attempt.questionId ? bankById.get(attempt.questionId) : undefined) ??
      (attempt.dedupeKey ? bankByDedupeKey.get(attempt.dedupeKey) : undefined) ??
      (attempt.scope && attempt.questionNumber != null
        ? bankByScopeAndNumber.get(`${attempt.scope}:${attempt.questionNumber}`)
        : undefined);
    const number = matchedQuestion?.number ?? attempt.questionNumber;
    const scope = matchedQuestion?.scope ?? attempt.scope;
    if (number == null || number < 1 || !scope) continue;

    const block = ensureBlock(scope, number);
    block.views += 1;
    if (attempt.isCorrect != null) {
      block.attempts += 1;
      if (attempt.isCorrect) block.correct += 1;
      else block.incorrect += 1;
    }
    const identity = matchedQuestion?.id ?? attempt.questionId ?? attempt.dedupeKey ?? `${scope}:${number}`;
    block.attemptedIds.add(identity);
    const detail = matchedQuestion ? questionStats.get(matchedQuestion.id) : undefined;
    if (detail) {
      detail.views += 1;
      if (attempt.isCorrect != null) {
        detail.attempts += 1;
        if (attempt.isCorrect) detail.correct += 1;
        else detail.incorrect += 1;
      }
    }
  }

  return Array.from(blocks.values())
    .map(({ attemptedIds, ...block }) => {
      const questions = bank
        .filter(
          (question) =>
            question.number != null &&
            question.scope === block.scope &&
            toBlockStart(question.number) === block.start,
        )
        .flatMap((question) => {
          const detail = questionStats.get(question.id);
          if (!detail) return [];
          return [{
            ...detail,
            accuracyRate: detail.attempts > 0 ? detail.correct / detail.attempts : null,
          }];
        })
        .sort((left, right) => left.number - right.number || left.id.localeCompare(right.id));
      return {
        ...block,
        questions,
        attemptedQuestionCount: attemptedIds.size,
        accuracyRate: block.attempts > 0 ? block.correct / block.attempts : null,
      };
    })
    .sort((left, right) => {
      if (left.scope !== right.scope) return left.scope === 'common' ? -1 : 1;
      return left.start - right.start;
    });
};
