import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { LearnShell } from '@/components/learn-shell';
import { EmptyState, Pill } from '@/components/ui/card';
import { publicApi } from '@/lib/server-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LearningSearchResponseSchema, type LearningSearchResponse } from '@osh/contracts';

export const dynamic = 'force-dynamic';

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const params = await searchParams;
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
    params.topic ? `/learning?topic=${encodeURIComponent(params.topic)}` : '/learning',
    LearningSearchResponseSchema,
  );

  return (
    <LearnShell signedIn={signedIn}>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">Learning hub</p>
      <h1 className="mt-2 text-[40px] font-semibold tracking-[-0.04em] text-fg">Learn the loop.</h1>
      <p className="mt-2 max-w-[62ch] text-[14px] leading-6 text-fg-muted">
        Git, branches, pull requests, tests and etiquette. {data.topics.length} short guides, no account
        required.
      </p>

      <nav aria-label="Topics" className="mt-6 flex flex-wrap gap-1.5">
        <Link
          href="/learn"
          className={`rounded-full border px-2.5 py-1 text-[11px] ${
            params.topic
              ? 'border-border text-fg-muted hover:border-border-strong hover:text-fg'
              : 'border-accent bg-accent-subtle text-accent'
          }`}
        >
          All topics
        </Link>
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
      </nav>

      {data.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No resources yet."
            description="Seed the database to add the learning content."
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
    </LearnShell>
  );
}
