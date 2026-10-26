import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueuePracticeSessionSync,
  readQueuedPracticeSessionSyncs,
  removeQueuedPracticeSessionSync,
  type PracticeSessionSyncPayload,
} from './practiceSessionSyncQueue';

const payload = (id: string, mode = 'custom'): PracticeSessionSyncPayload => ({
  session: {
    id,
    mode,
    title: 'Test a tu medida',
    startedAt: '2026-10-26T10:00:00.000Z',
    batchNumber: 1,
    batchSize: 1,
    batchStartIndex: null,
    nextStandardBatchStartIndex: null,
  },
  attempts: [{ question_id: '42', is_correct: false }],
  curriculum: 'osakidetza_electromedicina',
});

describe('practice session sync queue', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T10:30:00.000Z'));
  });

  it('keeps the original mode and payload until cloud sync succeeds', () => {
    expect(enqueuePracticeSessionSync('user-1', payload('session-1'))).toBe(true);
    expect(readQueuedPracticeSessionSyncs('user-1')).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        payload: expect.objectContaining({
          curriculum: 'osakidetza_electromedicina',
          session: expect.objectContaining({ id: 'session-1', mode: 'custom' }),
        }),
      }),
    ]);
  });

  it('replaces a repeated session id and removes it only when requested', () => {
    enqueuePracticeSessionSync('user-1', payload('session-1', 'standard'));
    enqueuePracticeSessionSync('user-1', payload('session-1', 'custom'));

    expect(readQueuedPracticeSessionSyncs('user-1')).toHaveLength(1);
    expect(readQueuedPracticeSessionSyncs('user-1')[0]?.payload.session.mode).toBe('custom');

    removeQueuedPracticeSessionSync('user-1', 'session-1');
    expect(readQueuedPracticeSessionSyncs('user-1')).toEqual([]);
  });
});
