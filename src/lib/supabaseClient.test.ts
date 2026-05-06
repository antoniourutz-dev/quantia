import { describe, expect, it } from 'vitest';
import { isInvalidRefreshTokenError } from './supabaseClient';

describe('isInvalidRefreshTokenError', () => {
  it('detects invalid refresh token messages', () => {
    expect(isInvalidRefreshTokenError(new Error('Invalid Refresh Token'))).toBe(true);
    expect(isInvalidRefreshTokenError(new Error('Refresh token not found'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isInvalidRefreshTokenError(new Error('network failure'))).toBe(false);
    expect(isInvalidRefreshTokenError(null)).toBe(false);
  });
});
