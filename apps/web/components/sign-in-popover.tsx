'use client';

import * as Popover from '@radix-ui/react-popover';
import { Github } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSupabase } from '@/components/supabase-provider';
import { errorMessage } from '@/lib/api-client';
import { friendlyOAuthError, useGitHubOAuthEnabled } from '@/lib/use-oauth';

export function SignInPopover({ signedIn = false }: { signedIn?: boolean }) {
  const supabase = useSupabase();
  const router = useRouter();
  const githubEnabled = useGitHubOAuthEnabled();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (signedIn) {
    return (
      <Link
        href="/discover"
        className="inline-flex h-9 items-center rounded-sm border border-border px-3 text-[13px] font-medium text-fg hover:border-border-strong"
      >
        Open app
      </Link>
    );
  }

  function scheduleOpen() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(true), 120);
  }
  function cancelOpen() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      setOpen(false);
      router.push('/discover');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function github() {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'read:user user:email public_repo',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) setError(friendlyOAuthError(oauthError.message));
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onMouseEnter={scheduleOpen}
          onMouseLeave={cancelOpen}
          className="inline-flex h-9 items-center rounded-sm border border-border px-3 text-[13px] font-medium text-fg transition-colors hover:border-border-strong"
        >
          Sign in
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[360px] rounded-md border border-border bg-canvas-subtle p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          <h2 className="text-[15px] font-semibold text-fg">Sign in</h2>
          <p className="mt-1 text-[12px] text-fg-muted">Continue to OpenSource-helper.</p>
          {githubEnabled === false ? (
            <p className="mt-4 rounded-sm border border-attention/30 bg-attention/10 px-3 py-2 text-[11px] leading-5 text-attention">
              GitHub sign-in is not enabled on this project yet. Use email below.
            </p>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                className="mt-4 w-full"
                onClick={github}
                disabled={githubEnabled !== true}
              >
                <Github size={17} strokeWidth={1.75} />
                {githubEnabled === null ? 'Checking GitHub…' : 'Continue with GitHub'}
              </Button>
              <p className="mt-1.5 text-[11px] text-fg-subtle">Skills filled from your repositories.</p>
            </>
          )}
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-[0.08em] text-fg-subtle">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? <p className="text-[11px] text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" loading={loading}>
              Continue
            </Button>
          </form>
          <div className="mt-3 flex items-center justify-between text-[11px] text-fg-muted">
            <Link href="/signup" className="text-accent hover:underline">
              Create an account
            </Link>
            <Link href="/forgot-password" className="text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border-muted pt-3">
            <span className="text-[10px] text-fg-subtle">Terms · Privacy</span>
            <ThemeToggle compact />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
