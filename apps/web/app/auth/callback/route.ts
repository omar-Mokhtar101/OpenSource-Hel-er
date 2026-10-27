import { NextResponse, type NextRequest } from 'next/server';
import { normalizeLoopbackOrigin } from '@/lib/public-url';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const code = request.nextUrl.searchParams.get('code');
  const next = sanitizeNext(request.nextUrl.searchParams.get('next'));
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin));
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin));
  }

  const providerToken = data.session?.provider_token;
  if (providerToken) {
    try {
      await fetch(`${API_URL.replace(/\/$/, '')}/github/connect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // The user can reconnect from Settings; never block the sign-in.
    }
  }
  return NextResponse.redirect(new URL(next, origin));
}

/**
 * Redirects must land on the URL the browser used, not on whatever host the
 * function sees internally. Behind a proxy or a Vercel service rewrite the
 * request URL can be an internal address, and a loopback alias (`0.0.0.0`)
 * is not reachable from the browser at all.
 */
function publicOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(/:$/, '');
  if (!host) return request.nextUrl.origin;
  try {
    const url = new URL(`${proto}://${host}`);
    return normalizeLoopbackOrigin(url.protocol, url.hostname, url.port);
  } catch {
    return request.nextUrl.origin;
  }
}

function sanitizeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/discover';
  try {
    const resolved = new URL(value, 'http://local.invalid');
    if (resolved.origin !== 'http://local.invalid') return '/discover';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/discover';
  }
}
