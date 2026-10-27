'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProgressStatus, ProgressSummary, Selection } from '@osh/contracts';
import { GitPullRequest, GripVertical, MessageSquare, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState, Pill, Skeleton, StatusPill } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn, relativeTime } from '@/lib/utils';

const COLUMNS: Array<{ status: ProgressStatus; title: string; hint: string }> = [
  { status: 'IN_PROGRESS', title: 'In Progress', hint: 'Reading, setting up, writing' },
  { status: 'PR_OPEN', title: 'PR Open', hint: 'Waiting on review' },
  { status: 'MERGED', title: 'Merged', hint: 'Done — cannot move back' },
  { status: 'PAUSED', title: 'Paused', hint: 'Set aside for now' },
];

const STATUS_LABEL: Record<ProgressStatus, string> = {
  IN_PROGRESS: 'In Progress',
  PR_OPEN: 'PR Open',
  MERGED: 'Merged',
  PAUSED: 'Paused',
  IGNORED: 'Ignored',
};

export default function ProgressPage() {
  const queryClient = useQueryClient();
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => apiFetch<ProgressSummary>('/progress'),
  });
  const [editing, setEditing] = useState<Selection | null>(null);
  const [status, setStatus] = useState<ProgressStatus>('IN_PROGRESS');
  const [prUrl, setPrUrl] = useState('');
  const [dragOver, setDragOver] = useState<ProgressStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`/progress/${editing!.id}`, {
        method: 'PATCH',
        body: { status, prUrl: prUrl || null },
      }),
    onSuccess: () => {
      setEditing(null);
      toast.success('Progress updated');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const move = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ProgressStatus }) =>
      apiFetch(`/progress/${id}`, { method: 'PATCH', body: { status: next } }),
    onSuccess: (_data, variables) => {
      toast.success(`Moved to ${STATUS_LABEL[variables.next]}`);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const sync = useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/progress/sync', { method: 'POST' }),
    onSuccess: () => toast.success('Sync queued. It runs in the background.'),
    onError: (error) => toast.error(errorMessage(error)),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['progress'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  function drop(event: React.DragEvent, column: ProgressStatus) {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    const item = data?.items.find((entry) => entry.id === id);
    if (!item || item.status === column) return;
    if (item.status === 'MERGED') {
      toast.error('A merged contribution cannot move back.');
      return;
    }
    move.mutate({ id: item.id, next: column });
  }

  const data = progress.data;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-fg">Your contributions</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-fg-muted">
            {data ? (
              <>
                <span>{data.counts.inProgress} In Progress</span>
                <span>·</span>
                <span>{data.counts.prOpen} PR Open</span>
                <span>·</span>
                <span>{data.counts.merged} Merged</span>
                {data.counts.paused > 0 ? (
                  <>
                    <span>·</span>
                    <span>{data.counts.paused} Paused</span>
                  </>
                ) : null}
              </>
            ) : (
              <Skeleton className="h-3 w-52" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-fg-subtle">
            updated {relativeTime(data?.lastSyncedAt)}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => sync.mutate()}
            loading={sync.isPending}
          >
            <RefreshCw size={13} /> Sync now
          </Button>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-fg-subtle">
        <GripVertical size={12} /> Drag a card to another column to change its status. You get an in-app
        notification for every move.
      </p>

      {progress.isLoading ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((column) => (
            <div key={column} className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : null}

      {!progress.isLoading && data && data.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing here yet."
            description="Pick an issue, confirm it, and it will appear here as In Progress."
            action={
              <Link href="/discover" className="text-[12px] text-accent hover:underline">
                Find an issue
              </Link>
            }
          />
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const items = data.items.filter((item) => item.status === column.status);
            return (
              <section
                key={column.status}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(column.status);
                }}
                onDragLeave={() => setDragOver((current) => (current === column.status ? null : current))}
                onDrop={(event) => drop(event, column.status)}
                className={cn(
                  'rounded-md border border-transparent p-1 transition-colors',
                  dragOver === column.status && 'border-accent/50 bg-accent-subtle/40',
                )}
              >
                <div className="mb-3 flex items-center justify-between border-t-2 border-border pt-2">
                  <div>
                    <h2 className="text-[12px] font-medium text-fg">{column.title}</h2>
                    <p className="text-[9px] text-fg-subtle">{column.hint}</p>
                  </div>
                  <span className="font-mono text-[10px] text-fg-subtle">{items.length}</span>
                </div>
                <div className="min-h-[60px] space-y-2">
                  {items.length === 0 ? (
                    <p className="rounded-sm border border-dashed border-border px-3 py-5 text-center text-[11px] text-fg-subtle">
                      {column.status === 'IN_PROGRESS' ? (
                        <Link href="/discover" className="text-accent hover:underline">
                          Find an issue
                        </Link>
                      ) : (
                        'Drop a card here.'
                      )}
                    </p>
                  ) : null}
                  {items.map((item) => {
                    const locked = item.status === 'MERGED';
                    return (
                      <article
                        key={item.id}
                        draggable={!locked}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', item.id);
                          event.dataTransfer.effectAllowed = 'move';
                          setDraggingId(item.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        className={cn(
                          'rounded-md border border-border bg-canvas-subtle p-4 transition-all',
                          !locked && 'cursor-grab active:cursor-grabbing hover:border-border-strong',
                          locked && 'opacity-80',
                          draggingId === item.id && 'opacity-40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-mono text-[10px] text-fg-subtle">
                            {item.issue.repoFullName}
                          </p>
                          {locked ? null : <GripVertical size={12} className="shrink-0 text-fg-subtle" />}
                        </div>
                        <Link
                          href={`/issues/${encodeURIComponent(item.issue.id)}?tab=guide`}
                          className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-5 text-fg hover:text-accent"
                        >
                          {item.issue.title}
                        </Link>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusPill status={item.status} />
                          {item.prUrl ? (
                            <a
                              href={item.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                            >
                              <GitPullRequest size={10} /> Pull request
                            </a>
                          ) : null}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-fg-subtle">
                            Selected {item.daysSinceSelected}d ago
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(item);
                              setStatus(item.status);
                              setPrUrl(item.prUrl ?? '');
                            }}
                            className="text-[10px] text-fg-muted hover:text-fg"
                          >
                            Update
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Link
                            href={`/issues/${encodeURIComponent(item.issue.id)}?tab=guide`}
                            className="inline-flex items-center gap-1 text-[10px] text-fg-muted hover:text-accent"
                          >
                            <MessageSquare size={10} /> Open guide
                          </Link>
                          <Link
                            href={`/issues/${encodeURIComponent(item.issue.id)}?tab=progress`}
                            className="text-[10px] text-fg-muted hover:text-accent"
                          >
                            History
                          </Link>
                        </div>
                        {locked ? (
                          <div className="mt-3 border-l-2 border-success pl-2 text-[10px] text-success">
                            Merged contribution
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {data && data.counts.ignored > 0 ? (
        <p className="mt-8 text-[11px] text-fg-subtle">
          <Pill>{data.counts.ignored} ignored</Pill> Ignored issues never appear in recommendations.
        </p>
      ) : null}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          title="Update progress"
          description="GitHub sync will correct this within five minutes."
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="progress-status">Status</Label>
              <Select
                id="progress-status"
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
              <Label htmlFor="progress-pr">Pull request URL</Label>
              <Input
                id="progress-pr"
                placeholder="https://github.com/owner/repo/pull/123"
                value={prUrl}
                onChange={(event) => setPrUrl(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => update.mutate()} loading={update.isPending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
