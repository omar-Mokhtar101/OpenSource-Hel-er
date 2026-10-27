'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GuideConversation,
  IssueContext,
  IssueDetails,
  IssueOnboarding,
  ProgressHistory,
  ProgressStatus,
  ProgressSummary,
  RepositoryOnboarding,
  SavedItem,
} from '@osh/contracts';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  CircleDot,
  Copy,
  ExternalLink,
  FileCode2,
  GitFork,
  GitPullRequest,
  Link2,
  ListChecks,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { GuideChat } from '@/components/guide-chat';
import { Prose } from '@/components/prose';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, Pill, Skeleton, StatusPill } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn, relativeTime, truncate } from '@/lib/utils';

type Tab = 'overview' | 'guide' | 'progress';

export function IssueDetail({
  issueId: rawId,
  initialTab = 'overview',
}: {
  issueId: string;
  initialTab?: string;
}) {
  const issueId = safeDecode(rawId);
  const encoded = encodeURIComponent(issueId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(
    initialTab === 'guide' || initialTab === 'progress' ? initialTab : 'overview',
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [prUrl, setPrUrl] = useState('');
  const [status, setStatus] = useState<ProgressStatus>('IN_PROGRESS');

  const details = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => apiFetch<IssueDetails>(`/discovery/issues/${encoded}`),
    retry: false,
  });
  const context = useQuery({
    queryKey: ['issue-context', issueId],
    queryFn: () => apiFetch<IssueContext>(`/discovery/issues/${encoded}/context`),
    retry: false,
  });
  const selected = Boolean(details.data?.selected);
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => apiFetch<ProgressSummary>('/progress'),
  });
  const selection = progress.data?.items.find((item) => item.issue.id === issueId);
  const onboarding = useQuery({
    queryKey: ['issue-onboarding', issueId],
    queryFn: () => apiFetch<IssueOnboarding>(`/onboarding/issue/${encoded}`),
    enabled: selected,
    retry: false,
  });
  const repository = useQuery({
    queryKey: ['repo-onboarding', issueId],
    queryFn: () => apiFetch<RepositoryOnboarding>(`/onboarding/repository/${encoded}`),
    enabled: selected,
    retry: false,
  });
  const conversation = useQuery({
    queryKey: ['guide', issueId],
    queryFn: () => apiFetch<GuideConversation>(`/guide/conversations/${encoded}`),
    enabled: selected,
    retry: false,
  });
  const history = useQuery({
    queryKey: ['progress-history', selection?.id],
    queryFn: () => apiFetch<ProgressHistory>(`/progress/${selection!.id}/history`),
    enabled: Boolean(selection),
  });

  const save = useMutation({
    mutationFn: () => apiFetch<SavedItem>('/saved/items', { method: 'POST', body: { issueId } }),
    onSuccess: () => {
      toast.success('Saved to “Later”');
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['saved-lists'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const ignore = useMutation({
    mutationFn: () => apiFetch('/discovery/ignore', { method: 'POST', body: { issueId } }),
    onSuccess: () => toast.success('Ignored. It will not be recommended again.'),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const select = useMutation({
    mutationFn: () =>
      apiFetch('/selection', { method: 'POST', body: { issueId, confirmed: true } }),
    onSuccess: () => {
      setConfirmOpen(false);
      setTab('guide');
      toast.success('In Progress. The guide is ready.');
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['guide', issueId] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const updateProgress = useMutation({
    mutationFn: () =>
      apiFetch(`/progress/${selection!.id}`, {
        method: 'PATCH',
        body: { status, prUrl: prUrl || null },
      }),
    onSuccess: () => {
      setUpdateOpen(false);
      toast.success('Progress updated');
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress-history', selection?.id] });
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (details.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (details.isError || !details.data) {
    return (
      <EmptyState
        title="This issue is unavailable"
        description={errorMessage(details.error)}
        action={
          <Link href="/discover" className="text-[12px] text-accent hover:underline">
            Back to Discover
          </Link>
        }
      />
    );
  }

  const issue = details.data.issue;
  const currentStatus = selection?.status;

  return (
    <div>
      <Link
        href="/discover"
        className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={13} /> Discover
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-fg-muted">{issue.repoFullName}</p>
          <h1 className="mt-1 max-w-[720px] text-[28px] font-semibold leading-9 tracking-[-0.03em] text-fg">
            {issue.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-fg-subtle">
            {currentStatus ? <StatusPill status={currentStatus} /> : <Pill>Not selected</Pill>}
            <span className="font-mono">#{issue.number}</span>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Open issue on GitHub <ExternalLink size={11} />
            </a>
            <a
              href={details.data.repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Open repository <ExternalLink size={11} />
            </a>
            <span>Active {issue.activityDays}d ago</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => save.mutate()}
            disabled={details.data.saved || save.isPending}
          >
            <Bookmark
              size={13}
              fill={details.data.saved ? 'currentColor' : 'none'}
              className={details.data.saved ? 'text-fg' : undefined}
            />{' '}
            {details.data.saved ? 'Saved' : 'Save'}
          </Button>
          <Link
            href={`/issues/${encoded}?tab=guide`}
            onClick={() => setTab('guide')}
            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border px-3 text-[12px] text-fg hover:border-border-strong"
          >
            Ask the guide
          </Link>
        </div>
      </div>

      <div
        className={cn(
          'mt-7',
          tab === 'guide'
            ? 'max-w-[1080px]'
            : 'grid gap-8 lg:grid-cols-[minmax(0,820px)_300px]',
        )}
      >
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="guide">AI guide</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-7">
                <section>
                  <h2 className="text-[16px] font-semibold text-fg">What the issue asks</h2>
                  {onboarding.data?.summary ? (
                    <Prose text={onboarding.data.summary} className="mt-2 max-w-[68ch]" />
                  ) : context.data ? (
                    <p className="mt-2 max-w-[68ch] text-[13px] leading-6 text-fg-muted">
                      The original issue text is below, followed by the repository, its README and the
                      exact commands to start. Nothing on this page needs the AI to be online.
                    </p>
                  ) : (
                    <p className="mt-2 max-w-[68ch] whitespace-pre-wrap text-[13px] leading-6 text-fg-muted">
                      {truncate(details.data.body || 'No description on GitHub.', 900)}
                    </p>
                  )}
                  {onboarding.data ? (
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
                      Generated from {onboarding.data.generatedFrom} · {relativeTime(onboarding.data.generatedAt)}
                    </p>
                  ) : null}
                </section>

                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[16px] font-semibold text-fg">The issue on GitHub</h2>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      Open issue <ExternalLink size={11} />
                    </a>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-fg-subtle">
                    {context.data?.issue.author ? <span>@{context.data.issue.author}</span> : null}
                    {context.data?.issue.createdAt ? (
                      <span>opened {new Date(context.data.issue.createdAt).toLocaleDateString()}</span>
                    ) : null}
                    <span className="font-mono">#{issue.number}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(context.data?.issue.labels ?? issue.labels).map((label) => (
                      <Pill key={label}>{label}</Pill>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-border bg-canvas-subtle p-4">
                    {context.isLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-11/12" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    ) : (
                      <Prose
                        text={
                          context.data?.issue.body ||
                          details.data.body ||
                          'No description was written on GitHub. Read the comments for context.'
                        }
                        className="max-w-[80ch]"
                      />
                    )}
                  </div>
                  {context.data && context.data.comments.length > 0 ? (
                    <details className="mt-3 rounded-md border border-border px-4 py-3">
                      <summary className="cursor-pointer text-[12px] text-fg-muted">
                        {context.data.comments.length} comment
                        {context.data.comments.length === 1 ? '' : 's'} on GitHub
                      </summary>
                      <ul className="mt-3 space-y-3">
                        {context.data.comments.slice(0, 10).map((comment) => (
                          <li key={`${comment.author}-${comment.createdAt}`} className="border-l-2 border-border pl-3">
                            <p className="text-[10px] text-fg-subtle">
                              @{comment.author} · {relativeTime(comment.createdAt)}
                            </p>
                            <Prose text={comment.body} className="mt-1 text-[12px]" />
                            {comment.url ? (
                              <a
                                href={comment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-accent hover:underline"
                              >
                                Open comment
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </section>

                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[16px] font-semibold text-fg">About the repository</h2>
                    <a
                      href={details.data.repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      Open repository <ExternalLink size={11} />
                    </a>
                  </div>
                  {context.isLoading ? (
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-10/12" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : context.isError || !context.data ? (
                    <div className="mt-2 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                      GitHub did not return the repository details. Read it directly on GitHub.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-3">
                      <p className="max-w-[80ch] text-[12px] leading-6 text-fg-muted">
                        {context.data.repo.description ?? 'No repository description.'}
                      </p>
                      <div className="flex flex-wrap gap-3 text-[11px] text-fg-muted">
                        <span className="inline-flex items-center gap-1">
                          <Star size={12} /> {context.data.repo.stars.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <GitFork size={12} /> {context.data.repo.forks.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CircleDot size={12} /> {context.data.repo.openIssues.toLocaleString()} open
                        </span>
                        {context.data.repo.license ? <span>{context.data.repo.license}</span> : null}
                        <span className="font-mono">default: {context.data.repo.defaultBranch}</span>
                      </div>
                      {context.data.repo.topics.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {context.data.repo.topics.map((topic) => (
                            <Pill key={topic} tone="accent">
                              {topic}
                            </Pill>
                          ))}
                        </div>
                      ) : null}
                      {context.data.repo.languages.length > 0 ? (
                        <div className="space-y-1">
                          {context.data.repo.languages
                            .filter((language) => language.percent > 0)
                            .map((language) => (
                            <div key={language.name} className="flex items-center gap-2 text-[10px] text-fg-subtle">
                              <span className="w-24 shrink-0">{language.name}</span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-muted">
                                <span
                                  className="block h-full rounded-full bg-accent"
                                  style={{ width: `${Math.max(2, language.percent)}%` }}
                                />
                              </span>
                              <span className="w-10 text-right">
                                {language.percent < 1 ? '<1%' : `${language.percent}%`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={context.data.links.readme}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-sm border border-border px-2.5 py-1 text-[11px] text-fg hover:border-border-strong"
                        >
                          <BookOpen size={11} /> README
                        </a>
                        {context.data.links.contributing ? (
                          <a
                            href={context.data.links.contributing}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-sm border border-border px-2.5 py-1 text-[11px] text-fg hover:border-border-strong"
                          >
                            <FileCode2 size={11} /> Contributing guide
                          </a>
                        ) : null}
                      </div>
                      {context.data.readme ? (
                        <details className="rounded-md border border-border px-3 py-2">
                          <summary className="cursor-pointer text-[12px] text-fg-muted">
                            README — what the project is and how it is built
                          </summary>
                          <div className="mt-2 max-h-[420px] overflow-auto pr-2">
                            <Prose text={context.data.readme} className="max-w-[80ch] text-[12px]" />
                          </div>
                        </details>
                      ) : null}
                      {context.data.contributing ? (
                        <details className="rounded-md border border-border px-3 py-2">
                          <summary className="cursor-pointer text-[12px] text-fg-muted">
                            CONTRIBUTING.md — the project&apos;s rules
                          </summary>
                          <div className="mt-2 max-h-[320px] overflow-auto pr-2">
                            <Prose text={context.data.contributing} className="max-w-[80ch] text-[12px]" />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  )}
                </section>

                {context.data ? (
                  <section>
                    <h2 className="text-[16px] font-semibold text-fg">Start from zero</h2>
                    <p className="mt-1 text-[12px] text-fg-muted">
                      Derived from the repository files — no AI. Run these in a terminal, then read the
                      issue and open a pull request.
                    </p>
                    <ol className="mt-3 space-y-2">
                      {context.data.commands.map((entry) => (
                        <li
                          key={entry.command}
                          className="rounded-md border border-border bg-canvas-subtle px-3 py-2"
                        >
                          <p className="text-[10px] uppercase tracking-[0.06em] text-fg-subtle">
                            {entry.label}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <code className="break-all font-mono text-[11px] text-fg">{entry.command}</code>
                            <button
                              type="button"
                              aria-label={`Copy: ${entry.command}`}
                              onClick={() => {
                                void navigator.clipboard.writeText(entry.command);
                                toast.success('Command copied');
                              }}
                              className="shrink-0 rounded-sm p-1 text-fg-subtle hover:bg-canvas hover:text-fg"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                <section>
                  <h2 className="text-[16px] font-semibold text-fg">What you&apos;ll need</h2>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(onboarding.data?.requirements.technologies ?? details.data.requirements.technologies).map(
                      (item) => (
                        <Pill key={item} tone="accent">{item}</Pill>
                      ),
                    )}
                    <Pill>{onboarding.data?.requirements.level ?? issue.level ?? 'Level not specified'}</Pill>
                  </div>
                  <ul className="mt-3 grid gap-1.5 text-[12px] text-fg-muted sm:grid-cols-2">
                    {(onboarding.data?.requirements.knowledge ?? details.data.requirements.knowledge).map(
                      (item) => (
                        <li key={item} className="flex gap-1.5">
                          <ChevronRight size={12} className="mt-1 shrink-0 text-accent" /> {item}
                        </li>
                      ),
                    )}
                  </ul>
                </section>

                <section>
                  <h2 className="text-[16px] font-semibold text-fg">Where to start</h2>
                  {!selected ? (
                    <p className="mt-2 text-[12px] text-fg-subtle">Select the issue to generate the reading path.</p>
                  ) : onboarding.isLoading ? (
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <ul className="mt-3 divide-y divide-border-muted rounded-md border border-border">
                      {(onboarding.data?.relatedFiles ?? []).map((file) => (
                        <li key={file.path} className="flex gap-3 px-3 py-3">
                          <FileCode2 size={15} className="mt-0.5 shrink-0 text-fg-subtle" />
                          <div>
                            <p className="break-all font-mono text-[11px] text-fg">{file.path}</p>
                            <p className="mt-0.5 text-[11px] leading-5 text-fg-muted">{file.why}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {selected && repository.data ? (
                  <section>
                    <h2 className="text-[16px] font-semibold text-fg">AI onboarding notes</h2>
                    <p className="mt-1 text-[11px] text-fg-subtle">
                      Generated after you selected the issue. The deterministic setup above is the source
                      of truth; treat this as a study aid.
                    </p>
                    <p className="mt-2 max-w-[68ch] text-[12px] leading-6 text-fg-muted">
                      {repository.data.overview}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <RepoList title="Setup" items={repository.data.setup} />
                      <RepoList title="Run" items={repository.data.run} />
                      <RepoList title="Test" items={repository.data.test} />
                      <RepoList title="Branch and PR" items={[...repository.data.branchGuidance, ...repository.data.prGuidance]} />
                    </div>
                  </section>
                ) : null}

                <section>
                  <h2 className="text-[16px] font-semibold text-fg">Prerequisites</h2>
                  <ul className="mt-3 space-y-2">
                    {details.data.requirements.prerequisites.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12px] text-fg-muted">
                        <Check size={13} className="mt-1 shrink-0 text-success" /> {item}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-[16px] font-semibold text-fg">Resources</h2>
                  <ul className="mt-3 grid gap-2">
                    {(onboarding.data?.resources ?? [
                      {
                        title: 'Repository',
                        url: details.data.repo.url,
                        kind: 'repository' as const,
                      },
                      { title: 'Issue discussion', url: issue.url, kind: 'issue' as const },
                    ]).map((resource) => (
                      <li key={resource.url}>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-4 rounded-sm border border-border px-3 py-2.5 text-[12px] text-fg hover:border-border-strong"
                        >
                          <span>{resource.title}</span>
                          <ExternalLink size={12} className="text-fg-subtle" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>

                {!selected ? (
                  <div className="rounded-md border border-accent/30 bg-accent-subtle p-4">
                    <p className="text-[13px] font-medium text-fg">Work on this issue</p>
                    <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                      It becomes your active issue, moves to In Progress, and unlocks onboarding and the guide.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" onClick={() => setConfirmOpen(true)}>
                        Start working
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => ignore.mutate()}
                        loading={ignore.isPending}
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="guide">
              {selected ? (
                <GuideChat
                  issueId={issueId}
                  conversation={conversation.data}
                  issueTitle={issue.title}
                />
              ) : (
                <EmptyState
                  title="Select the issue to open the guide"
                  description="The guide uses the issue, the README and your onboarding notes. It refuses to write the implementation."
                  action={
                    <Button type="button" onClick={() => setConfirmOpen(true)}>
                      Work on this issue
                    </Button>
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="progress">
              {selection ? (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-fg">Status timeline</p>
                      <p className="mt-0.5 text-[11px] text-fg-subtle">We check GitHub every 5 minutes.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setStatus(selection.status);
                        setPrUrl(selection.prUrl ?? '');
                        setUpdateOpen(true);
                      }}
                    >
                      Update status
                    </Button>
                  </div>
                  <ol className="relative ml-2 border-l border-border pl-5">
                    {(history.data?.events ?? []).map((event) => (
                      <li key={event.id} className="relative mb-5 last:mb-0">
                        <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-accent ring-4 ring-canvas" />
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={event.status} />
                          <span className="text-[11px] text-fg-subtle">
                            {event.source === 'SYNC' ? 'synced from GitHub' : 'manual'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-fg-subtle">{relativeTime(event.createdAt)}</p>
                        {event.note ? <p className="mt-1 text-[12px] text-fg-muted">{event.note}</p> : null}
                        {event.prUrl ? (
                          <a
                            href={event.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                          >
                            <GitPullRequest size={11} /> Pull request
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {selection.prUrl ? (
                    <div className="mt-5 rounded-sm border border-border px-3 py-2 text-[12px]">
                      <a
                        href={selection.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {selection.prUrl}
                      </a>
                    </div>
                  ) : null}
                  <div className="mt-6 rounded-sm border border-border bg-canvas-subtle p-3 text-[11px] leading-5 text-fg-subtle">
                    Update the status manually or attach your pull request. GitHub sync will correct it
                    within five minutes.
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Nothing here yet"
                  description="Select the issue to start tracking its progress."
                  action={<Button type="button" onClick={() => setConfirmOpen(true)}>Work on this issue</Button>}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>

        {tab === 'guide' ? null : (
          <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-3 rounded-md border border-border bg-canvas-subtle p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] text-fg-subtle">
              <Avatar name={issue.repoFullName} size={24} /> {issue.repoFullName}
            </div>
            <p className="line-clamp-3 text-[12px] leading-5 text-fg-muted">
              {issue.repoDescription ?? 'Open the repository to read its README and contribution rules.'}
            </p>
            <dl className="space-y-2 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-fg-subtle">Language</dt>
                <dd className="text-fg">{issue.language ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-fg-subtle">Level</dt>
                <dd className="text-fg">{issue.level ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-fg-subtle">Stars</dt>
                <dd className="tabular text-fg">{issue.stars.toLocaleString()}</dd>
              </div>
            </dl>
            {selected ? (
              <Button type="button" className="w-full" onClick={() => setTab('guide')}>
                <ListChecks size={14} /> Open the guide
              </Button>
            ) : (
              <Button type="button" className="w-full" onClick={() => setConfirmOpen(true)}>
                Work on this issue
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => save.mutate()}
              disabled={details.data.saved}
            >
              <Bookmark
                size={14}
                fill={details.data.saved ? 'currentColor' : 'none'}
                className={details.data.saved ? 'text-fg' : undefined}
              />{' '}
              {details.data.saved ? 'Saved' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                toast.success('Link copied');
              }}
              className="flex w-full items-center justify-center gap-1 text-[11px] text-fg-subtle hover:text-fg"
            >
              <Link2 size={11} /> Copy link
            </button>
            <p className="text-center text-[10px] text-fg-subtle">You can change your mind later.</p>
          </div>
        </aside>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Work on this issue?"
          description="It becomes your active issue and moves to In Progress. The guide will use this repository's context."
        >
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => select.mutate()} loading={select.isPending}>
              Start working
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent
          title="Update progress"
          description="GitHub sync will correct this within five minutes."
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as ProgressStatus)}
              >
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PR_OPEN">PR Open</option>
                <option value="MERGED">Merged</option>
                <option value="PAUSED">Paused</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="pr">Pull request URL</Label>
              <Input
                id="pr"
                placeholder="https://github.com/owner/repo/pull/123"
                value={prUrl}
                onChange={(event) => setPrUrl(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setUpdateOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => updateProgress.mutate()} loading={updateProgress.isPending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RepoList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-sm border border-border p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 6).map((item) => (
          <li key={item} className="break-words text-[11px] leading-5 text-fg-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
