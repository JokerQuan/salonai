import { describe, expect, it } from 'vitest';
import { buildHealthUrl } from './health';

describe('buildHealthUrl', () => {
  it('uses the default local API URL', () => {
    expect(buildHealthUrl(undefined)).toBe('http://localhost:3000/health');
  });

  it('trims trailing slashes from custom API URL', () => {
    expect(buildHealthUrl('http://localhost:4000/')).toBe('http://localhost:4000/health');
  });
});
