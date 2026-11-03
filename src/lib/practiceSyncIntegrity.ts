/**
 * A 2xx response is not proof that the student's attempts were persisted.
 * The currently deployed edge function replies with {success:true,sync:{...}}.
 * Validate the acknowledgement BEFORE deleting the durable local retry.
 */
export type SessionSaveStatus = 'saving' | 'saved' | 'pending' | 'unprotected' | 'not_recorded';

export const assertPracticeSyncAcknowledgement = (value: unknown, attemptedCount: number): void => {
  const failed = (): never => {
    throw new Error('No se pudo confirmar que todas las respuestas se hayan guardado.');
  };
  if (!Number.isSafeInteger(attemptedCount) || attemptedCount < 1) failed();
  if (!value || typeof value !== 'object' || Array.isArray(value)) failed();
  const response = value as { success?: unknown; sync?: unknown };
  if (response.success !== true || !response.sync || typeof response.sync !== 'object' || Array.isArray(response.sync)) failed();

  const report = response.sync as Record<string, unknown>;
  const validCount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const received = report.attemptsInPayload;
  const processed = report.attemptsProcessed;
  const duplicates = report.attemptsDuplicateIgnored;
  if (!validCount(received) || !validCount(processed) || !validCount(duplicates)) {
    throw new Error('No se pudo confirmar que todas las respuestas se hayan guardado.');
  }
  if (received < 1 || received > attemptedCount || processed + duplicates !== received) failed();
};
