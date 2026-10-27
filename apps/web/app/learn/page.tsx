import { ArrowUpRight, Search } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { EmptyState, Pill } from '@/components/ui/card';
import { publicApi } from '@/lib/server-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LearningSearchResponseSchema, type LearningSearchResponse } from '@osh/contracts';

export const dynamic = 'force-dynamic';

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim();
  let signedIn = false;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    signedIn = false;
  }
  const data = await publicApi<LearningSearchResponse>(
    query
      ? `/learning?q=${encodeURIComponent(query)}`
      : params.topic
        ? `/learning?topic=${encodeURIComponent(params.topic)}`
        : '/learning',
    LearningSearchResponseSchema,
  );

  return (
    <main className="min-h-screen bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-public items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            href={signedIn ? '/discover' : '/login'}
            className="text-[12px] text-fg-muted hover:text-fg"
          >
            {signedIn ? 'Open app' : 'Sign in'}
          </Link>
          <ThemeToggle compact />
        </div>
      </header>
      <div className="mx-auto w-full max-w-public px-6 pb-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">Learning hub</p>
        <h1 className="mt-2 text-[40px] font-semibold tracking-[-0.04em] text-fg">Learn the loop.</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-6 text-fg-muted">
          Git, branches, pull requests, tests and etiquette. Short guides, no account required.
        </p>

        <form className="mt-7 flex max-w-[560px] gap-2" action="/learn" method="get">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="search"
              name="q"
              defaultValue={query ?? ''}
              placeholder="Search a topic"
              aria-label="Search learning resources"
              className="h-10 w-full rounded-sm border border-border bg-canvas pl-9 pr-3 text-[13px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-sm bg-accent px-4 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {data.topics.map((topic) => (
            <Link
              key={topic}
              href={`/learn?topic=${encodeURIComponent(topic)}`}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                params.topic === topic
                  ? 'border-accent bg-accent-subtle text-accent'
                  : 'border-border text-fg-muted hover:border-border-strong hover:text-fg'
              }`}
            >
              {topic}
            </Link>
          ))}
        </div>

        {data.items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={query ? 'No results for that topic.' : 'No resources yet.'}
              description={query ? 'Try a broader word such as git, tests or reviews.' : 'Seed the database to add the learning content.'}
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {data.items.map((resource) => (
              <Link
                key={resource.id}
                href={`/learn/${resource.slug}`}
                className="group rounded-md border border-border bg-canvas-subtle p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <Pill>{resource.topic}</Pill>
                  <span className="text-[10px] text-fg-subtle">{resource.readingMinutes} min</span>
                </div>
                <p className="mt-3 text-[15px] font-semibold text-fg group-hover:text-accent">
                  {resource.title}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-fg-muted">{resource.summary}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-accent">
                  Read <ArrowUpRight size={11} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
