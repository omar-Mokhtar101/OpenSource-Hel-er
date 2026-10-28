import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroWindow } from '@/components/hero-window';
import { Logo } from '@/components/logo';
import { SignInPopover } from '@/components/sign-in-popover';
import { ThemeToggle } from '@/components/theme-toggle';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
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

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="hero-spotlight pointer-events-none absolute inset-x-0 top-0 h-[760px]" />
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-public items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <SignInPopover signedIn={signedIn} />
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-public flex-col items-center px-6 pt-[72px] text-center">
        <span className="rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
          Built for first-time contributors
        </span>
        <h1 className="mt-6 max-w-[900px] bg-gradient-to-b from-fg to-fg/80 bg-clip-text text-[clamp(40px,6vw,72px)] font-semibold leading-[1.02] tracking-[-0.045em] text-transparent">
          Find it. Learn it. Merge it.
        </h1>
        <p className="mt-6 max-w-[62ch] text-[18px] leading-[1.6] text-fg-muted">
          Open-source issues matched to your skills, explained step by step, guided to a merged pull
          request — without anyone writing the code for you.
        </p>
        <div className="mt-8 flex flex-col items-center">
          <Link
            href={signedIn ? '/discover' : '/signup'}
            className="inline-flex h-11 items-center gap-2 rounded-sm bg-accent px-6 text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Get started
            <ArrowRight size={16} strokeWidth={1.75} />
          </Link>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
            Free · GitHub or email · 2 minutes to set up
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-20 w-full max-w-public px-4 pb-24 sm:px-6">
        <HeroWindow />
      </section>

      <section className="mx-auto grid w-full max-w-public gap-6 px-6 pb-24 sm:grid-cols-3">
        {[
          ['01', 'Matched to you', 'Languages, level and skills decide the pool before the AI ranks it.'],
          ['02', 'Explained, not solved', 'Onboarding and a guide that refuses to write the implementation.'],
          ['03', 'Tracked to merged', 'Status syncs from GitHub every five minutes, with a dated history.'],
        ].map(([number, title, body]) => (
          <div key={number} className="border-t border-border pt-5">
            <p className="font-mono text-[10px] text-accent">{number}</p>
            <p className="mt-2 text-[14px] font-medium text-fg">{title}</p>
            <p className="mt-1 text-[13px] leading-6 text-fg-muted">{body}</p>
          </div>
        ))}
      </section>

      <footer className="mx-auto flex w-full max-w-public flex-col items-center justify-between gap-4 border-t border-border px-6 py-8 text-[13px] text-fg-subtle sm:flex-row">
        <span>© 2026 OpenPath</span>
        <div className="flex items-center gap-5">
          <a href="https://github.com" rel="noopener noreferrer" className="hover:text-fg">
            GitHub
          </a>
          <Link href="/learn" className="hover:text-fg">
            Learning
          </Link>
          <span>Privacy</span>
          <span>Terms</span>
          <ThemeToggle />
        </div>
      </footer>
    </main>
  );
}
