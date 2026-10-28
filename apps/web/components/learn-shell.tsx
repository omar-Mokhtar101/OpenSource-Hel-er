import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Learning stays public, but a signed-in reader keeps the app sidebar: the
 * shell is the same one every app page uses, so navigating between Learn and
 * Discover never drops the navigation.
 */
export function LearnShell({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  if (signedIn) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-public">{children}</div>
      </AppShell>
    );
  }
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-public items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[12px] text-fg-muted hover:text-fg">
            Sign in
          </Link>
          <ThemeToggle compact />
        </div>
      </header>
      <div className="mx-auto w-full max-w-public px-6 pb-24">{children}</div>
    </div>
  );
}
