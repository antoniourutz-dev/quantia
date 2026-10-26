export type PracticeSessionSyncPayload = {
  session: {
    id: string;
    mode: string;
    title: string;
    startedAt: string;
    batchNumber: number | null;
    batchSize: number | null;
    batchStartIndex: number | null;
    nextStandardBatchStartIndex: number | null;
  };
  attempts: Array<Record<string, unknown>>;
  curriculum: string;
};

export type QueuedPracticeSessionSync = {
  userId: string;
  queuedAt: string;
  payload: PracticeSessionSyncPayload;
};

const STORAGE_PREFIX = 'quantia.practice-session-sync.v1';
const MAX_PENDING_SESSIONS = 12;

const storageKey = (userId: string) => `${STORAGE_PREFIX}:${encodeURIComponent(userId)}`;

const isQueuedItem = (value: unknown, userId: string): value is QueuedPracticeSessionSync => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<QueuedPracticeSessionSync>;
  return (
    item.userId === userId &&
    typeof item.queuedAt === 'string' &&
    Boolean(item.payload) &&
    typeof item.payload?.session?.id === 'string' &&
    Array.isArray(item.payload?.attempts) &&
    typeof item.payload?.curriculum === 'string'
  );
};

export const readQueuedPracticeSessionSyncs = (userId: string): QueuedPracticeSessionSync[] => {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QueuedPracticeSessionSync => isQueuedItem(item, userId));
  } catch {
    return [];
  }
};

const writeQueue = (userId: string, items: QueuedPracticeSessionSync[]) => {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(-MAX_PENDING_SESSIONS)));
    return true;
  } catch {
    return false;
  }
};

export const enqueuePracticeSessionSync = (
  userId: string,
  payload: PracticeSessionSyncPayload,
) => {
  if (!userId) return false;
  const current = readQueuedPracticeSessionSyncs(userId);
  const next = current.filter((item) => item.payload.session.id !== payload.session.id);
  next.push({ userId, queuedAt: new Date().toISOString(), payload });
  return writeQueue(userId, next);
};

export const removeQueuedPracticeSessionSync = (userId: string, sessionId: string) => {
  if (!userId || !sessionId) return false;
  return writeQueue(
    userId,
    readQueuedPracticeSessionSyncs(userId).filter((item) => item.payload.session.id !== sessionId),
  );
};
