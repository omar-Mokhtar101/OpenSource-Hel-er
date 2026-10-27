import { describe, expect, it } from 'vitest';
import { parseContract } from './response-contracts';

describe('response contracts', () => {
  it('accepts a valid me response', () => {
    const parsed = parseContract('/me', 'GET', {
      id: 'u1',
      email: 'dev@example.com',
      name: 'Dev',
      username: null,
      bio: null,
      avatarUrl: null,
      role: 'DEVELOPER',
      github: { connected: false, login: null, connectedAt: null },
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
    });
    expect(parsed).toMatchObject({ id: 'u1', role: 'DEVELOPER' });
  });

  it('rejects a response without a role', () => {
    expect(() =>
      parseContract('/me', 'GET', {
        id: 'u1',
        email: 'dev@example.com',
        name: 'Dev',
        username: null,
        bio: null,
        avatarUrl: null,
        github: { connected: false, login: null, connectedAt: null },
        createdAt: new Date().toISOString(),
        lastSeenAt: null,
      }),
    ).toThrow(/did not match/);
  });

  it('requires exactly three recommendations', () => {
    expect(() =>
      parseContract('/discovery/recommendations', 'POST', {
        batchId: 'b1',
        recommendations: [],
        fallback: false,
        fallbackReason: null,
        generatedAt: new Date().toISOString(),
        remainingTokens: 10,
      }),
    ).toThrow(/did not match/);
  });

  it('accepts the deletion envelope for DELETE /me', () => {
    expect(
      parseContract('/me', 'DELETE', { requested: true, requestedAt: new Date().toISOString() }),
    ).toMatchObject({ requested: true });
  });

  it('leaves unknown routes untouched', () => {
    expect(parseContract('/unknown', 'GET', { any: true })).toEqual({ any: true });
  });

  it('validates the deterministic issue context route', () => {
    expect(() =>
      parseContract('/discovery/issues/acme%2Fwidgets%232/context', 'GET', { commands: [] }),
    ).toThrow(/did not match/);
  });
});
