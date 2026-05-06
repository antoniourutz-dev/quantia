import { describe, expect, it } from 'vitest';
import { buildLegacyInternalEmails } from './authUsername';

describe('buildLegacyInternalEmails', () => {
  it('returns empty array for blank input', () => {
    expect(buildLegacyInternalEmails('')).toEqual([]);
    expect(buildLegacyInternalEmails('   ')).toEqual([]);
  });

  it('returns single email when input already contains @', () => {
    expect(buildLegacyInternalEmails('User@Example.COM')).toEqual(['user@example.com']);
  });

  it('builds candidate emails for bare username', () => {
    const emails = buildLegacyInternalEmails('alice');
    expect(emails).toContain('alice@oposik.app');
    expect(emails).toContain('alice@quantia.app');
    expect(emails.length).toBe(2);
  });
});
