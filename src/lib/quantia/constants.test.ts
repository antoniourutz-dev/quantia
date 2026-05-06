import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRICULUM } from './constants';

describe('DEFAULT_CURRICULUM', () => {
  it('is a non-empty curriculum slug', () => {
    expect(DEFAULT_CURRICULUM.length).toBeGreaterThan(0);
    expect(DEFAULT_CURRICULUM).not.toContain(' ');
  });
});
