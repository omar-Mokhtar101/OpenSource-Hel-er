import { PublicProfileSchema, type PublicProfile } from '@osh/contracts';
import { ExternalLink, Github } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyLinkButton } from '@/components/copy-link-button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, Pill } from '@/components/ui/card';
import { publicApi, ServerApiError } from '@/lib/server-api';
import { appUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} · OpenPath`,
    description: 'An opt-in public contribution profile.',
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let profile: PublicProfile | null = null;
  try {
    profile = await publicApi<PublicProfile>(`/public/profiles/${encodeURIComponent(handle)}`, PublicProfileSchema);
  } catch (error) {
    if (!(error instanceof ServerApiError) || error.status !== 404) throw error;
  }

  return (
    <main className="min-h-screen bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-public items-center justify-between px-6">
        <Logo />
        <ThemeToggle compact />
      </header>

      {!profile ? (
        <section className="mx-auto flex w-full max-w-public flex-col items-center px-6 py-24 text-center">
          <div className="rounded-md border border-border bg-canvas-subtle px-8 py-10">
            <h1 className="text-[24px] font-semibold text-fg">This profile is private.</h1>
            <p className="mt-2 max-w-[48ch] text-[13px] leading-6 text-fg-muted">
              The owner has not published it, or the link is not valid. Nothing from their account is
              shown here.
            </p>
            <Link href="/" className="mt-5 inline-block text-[12px] text-accent hover:underline">
              Go home
            </Link>
          </div>
        </section>
      ) : (
        <article className="mx-auto w-full max-w-public px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-5">
              <Avatar name={profile.name} src={profile.avatarUrl} size={64} />
              <div>
                <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-fg">{profile.name}</h1>
                <p className="font-mono text-[12px] text-fg-subtle">@{profile.handle}</p>
                {profile.bio ? (
                  <p className="mt-2 max-w-[62ch] text-[13px] leading-6 text-fg-muted">{profile.bio}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CopyLinkButton url={`${appUrl()}/u/${profile.handle}`} />
              {profile.githubLogin ? (
                <a
                  href={`https://github.com/${profile.githubLogin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border px-3 text-[12px] text-fg hover:border-border-strong"
                >
                  <Github size={13} /> GitHub <ExternalLink size={10} />
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-[11px] text-fg-muted">
            <span>{profile.stats.merged} Merged</span>
            <span>·</span>
            <span>{profile.stats.prOpen} PR Open</span>
            <span>·</span>
            <span>{profile.stats.badges} Badges</span>
            <span>·</span>
            <span>{profile.stats.streak} day streak</span>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-[1fr_280px]">
            <div className="space-y-8">
              {profile.contributions ? (
                <section>
                  <h2 className="text-[16px] font-semibold text-fg">Merged contributions</h2>
                  {profile.contributions.length === 0 ? (
                    <p className="mt-2 text-[12px] text-fg-subtle">No activity yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-border-muted rounded-md border border-border">
                      {profile.contributions.map((contribution) => (
                        <li key={contribution.issueUrl} className="px-4 py-3">
                          <a
                            href={contribution.issueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-fg hover:text-accent"
                          >
                            {contribution.issueTitle}
                          </a>
                          <p className="mt-0.5 font-mono text-[10px] text-fg-subtle">
                            {contribution.repoFullName}
                            {contribution.mergedAt
                              ? ` · merged ${new Date(contribution.mergedAt).toLocaleDateString('en', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}`
                              : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {profile.badges ? (
                <section>
                  <h2 className="text-[16px] font-semibold text-fg">Badges</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {profile.badges.length === 0 ? (
                      <p className="text-[12px] text-fg-subtle">No badges shown.</p>
                    ) : (
                      profile.badges.map((badge) => (
                        <div key={badge.name} className="rounded-md border border-border p-3">
                          <p className="text-[12px] font-medium text-fg">{badge.name}</p>
                          <p className="mt-0.5 text-[10px] text-fg-subtle">{badge.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-5">
              {profile.skills && profile.skills.length > 0 ? (
                <section>
                  <h2 className="text-[12px] font-medium text-fg">Skills</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.skills.map((skill) => (
                      <Pill key={skill}>{skill}</Pill>
                    ))}
                  </div>
                </section>
              ) : null}
              {profile.languages && profile.languages.length > 0 ? (
                <section>
                  <h2 className="text-[12px] font-medium text-fg">Languages</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.languages.map((language) => (
                      <Pill key={language} tone="accent">
                        {language}
                      </Pill>
                    ))}
                  </div>
                </section>
              ) : null}
              {profile.streak ? (
                <section className="rounded-md border border-border p-4">
                  <h2 className="text-[12px] font-medium text-fg">Streak</h2>
                  <p className="tabular mt-1 text-[24px] font-semibold text-fg">{profile.streak.current}</p>
                  <p className="text-[10px] text-fg-subtle">current · longest {profile.streak.longest}</p>
                </section>
              ) : null}
              <p className="text-[10px] leading-5 text-fg-subtle">
                This profile is opt-in. The owner chooses which sections are visible.
              </p>
            </aside>
          </div>
        </article>
      )}
    </main>
  );
}
