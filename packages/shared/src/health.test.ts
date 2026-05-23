import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const result = healthResponseSchema.parse({
      status: 'ok',
      service: 'salonai-api',
      timestamp: '2026-05-24T00:00:00.000Z',
      version: '0.0.0',
    });

    expect(result.status).toBe('ok');
  });

  it('rejects invalid status values', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'down',
        service: 'salonai-api',
        timestamp: '2026-05-24T00:00:00.000Z',
        version: '0.0.0',
      }),
    ).toThrow();
  });
});
