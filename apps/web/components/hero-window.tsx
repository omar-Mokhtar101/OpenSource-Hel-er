'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronRight, FileText, GitBranch, Search, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

const CAPTIONS = ['SEARCHING GITHUB', 'RANKING FOR YOU', 'EXPLAINING THE REPO', 'SYNCED FROM GITHUB'];
const CARDS = [
  { repo: 'vercel/next.js', title: 'Add keyboard navigation to the docs search', tone: 'TypeScript' },
  { repo: 'withastro/astro', title: 'Improve the error message for a missing adapter', tone: 'TypeScript' },
  { repo: 'fastapi/fastapi', title: 'Document the dependency override pattern', tone: 'Python' },
];

export function HeroWindow() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(reduce ? 1 : 0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (reduce && !playing) return;
    const timer = setInterval(() => {
      setScene((current) => (current + 1) % 4);
    }, 3800);
    return () => clearInterval(timer);
  }, [reduce, playing]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg border border-border bg-canvas-inset shadow-[0_24px_80px_rgba(0,0,0,0.55)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex h-9 items-center gap-2 border-b border-border-muted px-4">
          <span className="h-2 w-2 rounded-full bg-danger/70" />
          <span className="h-2 w-2 rounded-full bg-attention/70" />
          <span className="h-2 w-2 rounded-full bg-success/70" />
          <div className="mx-auto rounded-full border border-border-muted px-4 py-1 font-mono text-[10px] text-fg-subtle">
            openpath.app/discover
          </div>
        </div>
        <div className="relative h-[380px] overflow-hidden p-5 sm:h-[520px] sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
                Your next contribution
              </p>
              <p className="mt-1 text-[16px] font-semibold text-fg">Three issues chosen for you</p>
            </div>
            <span className="rounded-full border border-border px-2 py-1 font-mono text-[10px] text-fg-subtle">
              profile 80%
            </span>
          </div>

          <AnimatePresence mode="wait">
            {scene === 0 ? (
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative grid grid-cols-3 gap-2"
              >
                {Array.from({ length: 9 }).map((_, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: index < 6 ? 0.35 : 0.6, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-md border border-border-muted bg-canvas-subtle p-3"
                  >
                    <div className="h-2 w-16 rounded bg-border" />
                    <div className="mt-3 h-2 w-full rounded bg-border-muted" />
                    <div className="mt-1.5 h-2 w-3/4 rounded bg-border-muted" />
                  </motion.div>
                ))}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-scan bg-gradient-to-r from-transparent via-accent/10 to-transparent" />
                <div className="absolute inset-x-0 top-1/2 flex justify-center">
                  <span className="rounded-full border border-border bg-canvas px-3 py-1.5 font-mono text-[10px] text-fg-muted">
                    <Search size={11} className="mr-1.5 inline" />
                    12,480 open issues
                  </span>
                </div>
              </motion.div>
            ) : null}

            {scene === 1 ? (
              <motion.div
                key="rank"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid gap-2 sm:grid-cols-3"
              >
                {CARDS.map((card, index) => (
                  <motion.div
                    key={card.repo}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="rounded-md border border-border bg-canvas-subtle p-4"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-[10px] text-fg-muted">{card.repo}</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-subtle font-mono text-[10px] text-accent">
                        {index + 1}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-[13px] font-medium leading-5 text-fg">
                      {card.title}
                    </p>
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
                      Why this fits you
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-fg-muted">
                      You know {card.tone} and this is scoped for a first contribution.
                    </p>
                    <span className="mt-3 inline-block rounded-full border border-border px-2 py-0.5 text-[9px] text-fg-subtle">
                      {card.tone}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            ) : null}

            {scene === 2 ? (
              <motion.div
                key="learn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid gap-3 sm:grid-cols-[1.2fr_1fr]"
              >
                <div className="rounded-md border border-border bg-canvas-subtle p-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-fg-subtle">
                    <Star size={11} /> vercel/next.js · #48213
                  </div>
                  <p className="mt-2 text-[15px] font-semibold leading-6 text-fg">
                    Add keyboard navigation to the docs search
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {['TypeScript', 'Beginner', 'good first issue'].map((chip) => (
                      <span key={chip} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-fg-muted">
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 rounded-sm border border-accent/30 bg-accent-subtle p-3">
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-accent">
                      Work on this issue
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-fg-muted">
                      It becomes your active issue and moves to In Progress.
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-canvas-subtle p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
                    Read first
                  </p>
                  <ul className="mt-3 space-y-3">
                    {[
                      { icon: FileText, title: 'Read the README', detail: 'Purpose and setup' },
                      { icon: GitBranch, title: 'Run the tests', detail: 'Confirm the baseline' },
                      { icon: ChevronRight, title: 'Open a PR', detail: 'Link the issue' },
                    ].map((item) => (
                      <li key={item.title} className="flex gap-2.5">
                        <item.icon size={14} className="mt-0.5 text-accent" />
                        <div>
                          <p className="text-[11px] font-medium text-fg">{item.title}</p>
                          <p className="text-[10px] text-fg-subtle">{item.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ) : null}

            {scene === 3 ? (
              <motion.div
                key="merge"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-[240px] flex-col items-center justify-center rounded-md border border-border bg-canvas-subtle"
              >
                <div className="flex items-center gap-2 font-mono text-[10px] text-fg-subtle">
                  <span>In Progress</span>
                  <ChevronRight size={11} />
                  <span>PR Open</span>
                  <ChevronRight size={11} />
                  <span className="text-success">Merged</span>
                </div>
                <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success">
                  <Check size={26} strokeWidth={2} />
                </div>
                <p className="mt-4 text-[15px] font-semibold text-fg">Your first merged PR</p>
                <p className="mt-1 text-[11px] text-fg-muted">Synced from GitHub in under 5 minutes.</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="absolute bottom-4 left-6 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {CAPTIONS[scene]}
          </div>
          {reduce && !playing ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute bottom-4 right-5 rounded-sm border border-border px-2.5 py-1 text-[10px] text-fg-muted hover:text-fg"
            >
              Play the story
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
