import { LearningResourceSchema, type LearningResource } from '@osh/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LearnShell } from '@/components/learn-shell';
import { Prose } from '@/components/prose';
import { Pill } from '@/components/ui/card';
import { publicApi, ServerApiError } from '@/lib/server-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LearnArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
  let resource: LearningResource | null = null;
  try {
    resource = await publicApi<LearningResource>(`/learning/${encodeURIComponent(slug)}`, LearningResourceSchema);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <LearnShell signedIn={signedIn}>
      <article className="max-w-[720px] pb-24">
        <Link href="/learn" className="text-[12px] text-fg-muted hover:text-fg">
          ← Learning hub
        </Link>
        <div className="mt-6 flex items-center gap-2">
          <Pill>{resource.topic}</Pill>
          <span className="text-[10px] text-fg-subtle">{resource.readingMinutes} min read</span>
        </div>
        <h1 className="mt-3 text-[38px] font-semibold leading-[1.1] tracking-[-0.04em] text-fg">
          {resource.title}
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-7 text-fg-muted">{resource.summary}</p>
        <Prose text={resource.body} className="mt-8 max-w-[68ch] text-[14px] leading-7" />
        {resource.externalUrl ? (
          <a
            href={resource.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block text-[12px] text-accent hover:underline"
          >
            Read the official documentation
          </a>
        ) : null}
        <div className="mt-10 border-t border-border pt-5 text-[12px] text-fg-muted">
          Was this helpful?{' '}
          <Link href="/learn" className="text-accent hover:underline">
            Browse another topic
          </Link>
          .
        </div>
      </article>
    </LearnShell>
  );
}
