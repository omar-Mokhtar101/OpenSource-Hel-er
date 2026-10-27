import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = [
  '/onboarding',
  '/discover',
  '/issues',
  '/progress',
  '/saved',
  '/notifications',
  '/achievements',
  '/settings',
  '/community',
  '/requests',
  '/admin',
];

const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.search = '';
    redirect.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return redirectWithCookies(redirect, response);
  }
  if (user && AUTH_PAGES.includes(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/discover';
    redirect.search = '';
    return redirectWithCookies(redirect, response);
  }
  return response;
}

function redirectWithCookies(target: URL, response: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(target);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)'],
  // Next.js 15 defaults middleware to the Edge runtime. Vercel Services reject
  // any Edge Function output ("Service X produced Edge Function output
  // middleware"), so this must run on Node. Stable since Next 15.5.
  runtime: 'nodejs',
};
