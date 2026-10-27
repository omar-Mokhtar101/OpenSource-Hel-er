'use client';

import type { Recommendation } from '@osh/contracts';
import { Bookmark, ExternalLink, Star, X } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Pill } from '@/components/ui/card';
import { relativeTime, truncate } from '@/lib/utils';

export function RecommendationCard({
  recommendation,
  saved = false,
  onSave,
  onIgnore,
}: {
  recommendation: Recommendation;
  saved?: boolean;
  onSave: () => void;
  onIgnore: () => void;
}) {
  const { issue, rank, reason } = recommendation;
  const active = issue.activityDays <= 30;
  return (
    <motion.article
      initial={{ y: 8 }}
      animate={{ y: 0 }}
      transition={{ delay: (rank - 1) * 0.04, duration: 0.22 }}
      className="flex h-full flex-col rounded-md border border-border bg-canvas-subtle p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-subtle font-mono text-[11px] text-accent">
          {rank}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-fg-subtle">
          <span className={active ? 'h-1.5 w-1.5 rounded-full bg-success' : 'h-1.5 w-1.5 rounded-full bg-attention'} />
          {active ? `Active ${issue.activityDays}d` : `Quiet ${issue.activityDays}d`}
        </span>
      </div>
      <p className="mt-3 truncate font-mono text-[11px] text-fg-muted">{issue.repoFullName}</p>
      <Link
        href={`/issues/${encodeURIComponent(issue.id)}`}
        className="mt-1.5 line-clamp-2 text-[17px] font-semibold leading-6 tracking-[-0.01em] text-fg hover:text-accent"
      >
        {issue.title}
      </Link>

      <div className="mt-4 rounded-sm border-l-2 border-accent/40 bg-canvas px-3 py-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">Why this fits you</p>
        <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-fg-muted">{truncate(reason, 180)}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[issue.language, issue.level, ...issue.labels]
          .filter((value): value is string => Boolean(value))
          .slice(0, 3)
          .map((label) => (
            <Pill key={label}>{label}</Pill>
          ))}
        {issue.labels.length + 1 > 3 ? <Pill>+{issue.labels.length - 2}</Pill> : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <Link
          href={`/issues/${encodeURIComponent(issue.id)}`}
          className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
        >
          View details <ExternalLink size={12} />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSave}
            disabled={saved}
            className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] text-fg-muted hover:bg-canvas hover:text-fg disabled:cursor-default disabled:text-fg"
            aria-label={saved ? `${issue.title} saved` : `Save ${issue.title}`}
            aria-pressed={saved}
          >
            <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onIgnore}
            className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] text-fg-muted hover:bg-canvas hover:text-danger"
            aria-label={`Ignore ${issue.title}`}
          >
            <X size={13} /> Ignore
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 font-mono text-[9px] text-fg-subtle">
        <Star size={10} /> {issue.stars.toLocaleString()} · updated {relativeTime(issue.updatedAt)}
      </div>
    </motion.article>
  );
}
