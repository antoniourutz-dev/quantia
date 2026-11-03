import { describe, expect, it } from 'vitest';
import { assertPracticeSyncAcknowledgement } from './practiceSyncIntegrity';

describe('acknowledgement of practice session durability', () => {
  it('accepts a complete initial save', () => {
    expect(() => assertPracticeSyncAcknowledgement({
      success: true, sync: {
        attemptsInPayload: 3, attemptsProcessed: 3, attemptsDuplicateIgnored: 0,
      },
    }, 3)).not.toThrow();
  });

  it('accepts an idempotent retry when all attempts were already recorded', () => {
    expect(() => assertPracticeSyncAcknowledgement({
      success: true, sync: {
        attemptsInPayload: 2, attemptsProcessed: 0, attemptsDuplicateIgnored: 2,
      },
    }, 2)).not.toThrow();
  });

  it.each([
    null,
    { success: false },
    { success: true },
    { success: true, sync: { attemptsInPayload: 2 } },
    { success: true, sync: { attemptsInPayload: 2, attemptsProcessed: 1, attemptsDuplicateIgnored: 0 } },
    { success: true, sync: { attemptsInPayload: 3, attemptsProcessed: 3, attemptsDuplicateIgnored: 0 } },
    { success: true, sync: { attemptsInPayload: 0, attemptsProcessed: 0, attemptsDuplicateIgnored: 0 } },
  ])('rejects invalid or partial success responses and preserves local retry', (reply) => {
    expect(() => assertPracticeSyncAcknowledgement(reply, 2)).toThrow(
      'No se pudo confirmar que todas las respuestas se hayan guardado.',
    );
  });
});
