import { describe, it, expect } from 'vitest';
import { sanitizeFtsQuery } from '../lib/searchSanitizer';

describe('SQLite FTS5 Query Sanitizer', () => {
  it('strips dangerous keywords and special characters', () => {
    expect(sanitizeFtsQuery('bug AND feature')).toBe('"bug"* "feature"*');
    expect(sanitizeFtsQuery('test* "exact" (grouped)')).toBe('"test"* "exact"* "grouped"*');
    expect(sanitizeFtsQuery('')).toBe('');
    expect(sanitizeFtsQuery('   ')).toBe('');
  });
});
