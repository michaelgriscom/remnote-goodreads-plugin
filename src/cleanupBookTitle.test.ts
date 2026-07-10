import { describe, expect, it } from 'vitest';
import { cleanupBookTitle } from './cleanupBookTitle';

describe('cleanupBookTitle', () => {
  it('removes subtitles after a colon', () => {
    expect(cleanupBookTitle('Dune: Deluxe Edition')).toBe('Dune');
  });

  it('removes trailing series information in parentheses', () => {
    expect(cleanupBookTitle('The Fellowship of the Ring (The Lord of the Rings, #1)')).toBe(
      'The Fellowship of the Ring'
    );
  });

  it('removes trailing edition information', () => {
    expect(cleanupBookTitle('Clean Code 2nd Edition')).toBe('Clean Code');
    expect(cleanupBookTitle('The C Programming Language Revised Edition')).toBe(
      'The C Programming Language'
    );
  });

  it('leaves plain titles untouched', () => {
    expect(cleanupBookTitle('Snow Crash')).toBe('Snow Crash');
  });

  it('keeps parentheses that are not trailing', () => {
    expect(cleanupBookTitle('Bob (Not Alice) Explains')).toBe('Bob (Not Alice) Explains');
  });
});
