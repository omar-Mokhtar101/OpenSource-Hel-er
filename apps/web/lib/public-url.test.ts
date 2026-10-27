import { describe, expect, it } from 'vitest';
import { normalizeLoopbackOrigin } from './public-url';

describe('normalizeLoopbackOrigin', () => {
  it('keeps a real public origin untouched', () => {
    expect(normalizeLoopbackOrigin('https:', 'opensource-helper.vercel.app', '')).toBe(
      'https://opensource-helper.vercel.app',
    );
  });

  it('keeps a non-default port on a real host', () => {
    expect(normalizeLoopbackOrigin('http:', 'localhost', '3001')).toBe('http://localhost:3001');
  });

  it('rewrites 0.0.0.0 to localhost, which Firefox can actually open', () => {
    expect(normalizeLoopbackOrigin('http:', '0.0.0.0', '3000')).toBe('http://localhost:3000');
  });

  it('rewrites the other loopback aliases to localhost', () => {
    expect(normalizeLoopbackOrigin('http:', '127.0.0.1', '3000')).toBe('http://localhost:3000');
    expect(normalizeLoopbackOrigin('http:', '::1', '3000')).toBe('http://localhost:3000');
    expect(normalizeLoopbackOrigin('http:', '[::1]', '3000')).toBe('http://localhost:3000');
  });
});
