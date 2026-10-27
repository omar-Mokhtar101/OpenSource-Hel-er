/**
 * Absolute URL for a browser-initiated redirect: OAuth, email confirmation and
 * password reset all hand Supabase a `redirectTo` and it must match the
 * project's redirect allow-list exactly.
 *
 * The browser origin is the right base in production, but a dev server, a
 * Docker port mapping or a WSL host can hand out `0.0.0.0` (or `127.0.0.1`).
 * Firefox refuses to open `0.0.0.0` at all, and Supabase treats every alias as
 * a different URL, so the loopback aliases collapse to the one the allow-list
 * knows: `http://localhost:<port>`.
 */
const LOOPBACK_HOSTS = new Set(['0.0.0.0', '127.0.0.1', '::1', '[::1]']);

/** Pure so it can be unit tested without a DOM. */
export function normalizeLoopbackOrigin(protocol: string, hostname: string, port: string): string {
  const host = LOOPBACK_HOSTS.has(hostname) ? 'localhost' : hostname;
  return `${protocol}//${port ? `${host}:${port}` : host}`;
}

export function publicOrigin(): string {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port } = window.location;
  return normalizeLoopbackOrigin(protocol, hostname, port);
}

/** `${origin}/auth/callback`, with an optional post-sign-in path. */
export function oauthCallbackUrl(next?: string): string {
  const callback = `${publicOrigin()}/auth/callback`;
  return next ? `${callback}?next=${encodeURIComponent(next)}` : callback;
}
