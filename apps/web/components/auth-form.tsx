'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Helper, Input, Label } from '@/components/ui/input';
import { useSupabase } from '@/components/supabase-provider';
import { errorMessage } from '@/lib/api-client';
import { friendlyOAuthError, useGitHubOAuthEnabled } from '@/lib/use-oauth';

type Mode = 'login' | 'signup';

export function AuthForm({ mode, next = '/discover' }: { mode: Mode; next?: string }) {
  const supabase = useSupabase();
  const router = useRouter();
  const githubEnabled = useGitHubOAuthEnabled();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice('Check your inbox to confirm your email, then sign in.');
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      router.push(next);
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
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) setError(friendlyOAuthError(oauthError.message));
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-fg">
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-fg-muted">
          {mode === 'login'
            ? 'Continue to OpenSource-helper.'
            : 'Two minutes to set up. No card, no trial.'}
        </p>
      </div>

      {githubEnabled === false ? (
        <div className="rounded-sm border border-attention/30 bg-attention/10 px-3 py-2.5 text-[12px] leading-5 text-attention">
          GitHub sign-in is not enabled on this Supabase project yet. Use email and password below —
          everything except automatic PR sync works without GitHub.
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={github}
            disabled={githubEnabled !== true}
          >
            <Github size={18} strokeWidth={1.75} />
            {githubEnabled === null ? 'Checking GitHub…' : 'Continue with GitHub'}
          </Button>
          <Helper>Skills filled from your repositories.</Helper>
        </>
      )}

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' ? (
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </div>
        ) : null}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password" hint={mode === 'signup' ? 'Minimum 8 characters' : undefined}>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-fg-subtle hover:text-fg"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        {notice ? (
          <p className="rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-success">
            {notice}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {mode === 'login' ? 'Continue' : 'Create account'}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-[12px] text-fg-muted">
        <span>
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <Link
            href={mode === 'login' ? '/signup' : '/login'}
            className="text-accent hover:underline"
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </Link>
        </span>
        {mode === 'login' ? (
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot password?
          </Link>
        ) : null}
      </div>
    </div>
  );
}
