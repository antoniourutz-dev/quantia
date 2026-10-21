import type { Question } from '../types';
import type { PracticeMode } from '../types';
import { supabase } from './supabaseClient';

const STORAGE_PREFIX = 'quantia.question_activity.v1';
const MAX_EVENTS = 20000;
const SYNC_BATCH_SIZE = 100;
const SYNC_DELAY_MS = 500;

export type QuestionActivityEvent = {
  eventId: string;
  sessionId: string;
  surface: 'test' | 'mistake-review' | 'study' | 'question-bank' | 'legacy-local';
  mode: PracticeMode | 'study' | 'question-bank' | null;
  questionId: string;
  questionNumber: number | null;
  scope: Question['syllabus'];
  text: string;
  viewedAt: string;
  answeredAt: string | null;
  isCorrect: boolean | null;
  pending: boolean;
};

export type ActivityContext = { userId: string; curriculum: string };
type ViewInput = ActivityContext & {
  eventId: string;
  sessionId: string;
  surface: QuestionActivityEvent['surface'];
  mode: QuestionActivityEvent['mode'];
  question: Question;
};

const scheduledSyncs = new Map<string, ReturnType<typeof setTimeout>>();
const runningSyncs = new Map<string, Promise<void>>();

const storageKey = ({ userId, curriculum }: ActivityContext) =>
  `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(curriculum)}`;

const readEvents = (context: ActivityContext): QuestionActivityEvent[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(context)) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const raw = item as Partial<QuestionActivityEvent>;
      if (!raw.eventId || !raw.questionId || !raw.sessionId || !raw.viewedAt) return [];
      if (raw.scope !== 'common' && raw.scope !== 'specific') return [];
      return [{
        eventId: raw.eventId,
        sessionId: raw.sessionId,
        surface: raw.surface ?? 'legacy-local',
        mode: raw.mode ?? null,
        questionId: raw.questionId,
        questionNumber: typeof raw.questionNumber === 'number' ? raw.questionNumber : null,
        scope: raw.scope,
        text: raw.text ?? '',
        viewedAt: raw.viewedAt,
        answeredAt: raw.answeredAt ?? (raw.isCorrect == null ? null : raw.viewedAt),
        isCorrect: typeof raw.isCorrect === 'boolean' ? raw.isCorrect : null,
        pending: raw.pending !== false,
      } satisfies QuestionActivityEvent];
    });
  } catch {
    return [];
  }
};

const toCloudRow = (context: ActivityContext, event: QuestionActivityEvent) => ({
  event_id: event.eventId,
  user_id: context.userId,
  curriculum: context.curriculum,
  session_id: event.sessionId,
  surface: event.surface,
  mode: event.mode,
  question_id: event.questionId,
  question_number: event.questionNumber,
  question_scope: event.scope,
  viewed_at: event.viewedAt,
  answered_at: event.answeredAt,
  is_correct: event.isCorrect,
});

const eventVersion = (event: QuestionActivityEvent) =>
  `${event.isCorrect ?? 'unanswered'}:${event.answeredAt ?? ''}`;

export const syncQuestionActivity = async (context: ActivityContext): Promise<void> => {
  const key = storageKey(context);
  const running = runningSyncs.get(key);
  if (running) return running;

  const sync = (async () => {
    let pending = readEvents(context).filter((event) => event.pending).slice(0, SYNC_BATCH_SIZE);
    while (pending.length > 0) {
      const versions = new Map(pending.map((event) => [event.eventId, eventVersion(event)]));
      const { error } = await supabase
        .from('user_question_activity')
        .upsert(pending.map((event) => toCloudRow(context, event)), { onConflict: 'event_id' });
      if (error) throw error;

      const latest = readEvents(context);
      let changed = false;
      const next = latest.map((event) => {
        const syncedVersion = versions.get(event.eventId);
        if (!syncedVersion || eventVersion(event) !== syncedVersion || !event.pending) return event;
        changed = true;
        return { ...event, pending: false };
      });
      if (changed) writeEvents(context, next);
      pending = readEvents(context).filter((event) => event.pending).slice(0, SYNC_BATCH_SIZE);
    }
  })().finally(() => runningSyncs.delete(key));

  runningSyncs.set(key, sync);
  return sync;
};

const scheduleSync = (context: ActivityContext) => {
  if (typeof window === 'undefined') return;
  const key = storageKey(context);
  const current = scheduledSyncs.get(key);
  if (current) clearTimeout(current);
  scheduledSyncs.set(key, setTimeout(() => {
    scheduledSyncs.delete(key);
    void syncQuestionActivity(context).catch(() => {
      // El evento sigue pendiente en local y se reintentará más adelante.
    });
  }, SYNC_DELAY_MS));
};

const writeEvents = (context: ActivityContext, events: QuestionActivityEvent[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(context), JSON.stringify(events.slice(-MAX_EVENTS)));
    window.dispatchEvent(new CustomEvent('quantia:question-activity-changed'));
  } catch {
    // El seguimiento no debe interrumpir una sesión si el navegador bloquea el almacenamiento.
  }
};

export const recordQuestionView = (input: ViewInput) => {
  const events = readEvents(input);
  if (events.some((event) => event.eventId === input.eventId)) return;
  events.push({
    eventId: input.eventId,
    sessionId: input.sessionId,
    surface: input.surface,
    mode: input.mode,
    questionId: input.question.id,
    questionNumber: input.question.number,
    scope: input.question.syllabus,
    text: input.question.text,
    viewedAt: new Date().toISOString(),
    answeredAt: null,
    isCorrect: null,
    pending: true,
  });
  writeEvents(input, events);
  scheduleSync(input);
};

export const recordQuestionAnswer = (
  context: ActivityContext & { eventId: string; isCorrect: boolean },
) => {
  const events = readEvents(context);
  const index = events.findIndex((event) => event.eventId === context.eventId);
  if (index < 0) return;
  events[index] = {
    ...events[index],
    answeredAt: new Date().toISOString(),
    isCorrect: context.isCorrect,
    pending: true,
  };
  writeEvents(context, events);
  scheduleSync(context);
};

export const getQuestionActivity = (context: ActivityContext) => readEvents(context);
