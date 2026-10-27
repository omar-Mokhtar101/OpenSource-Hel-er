'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useSupabase } from '@/components/supabase-provider';
import { errorMessage } from '@/lib/api-client';
import { oauthCallbackUrl } from '@/lib/public-url';

export default function ForgotPasswordPage() {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: oauthCallbackUrl('/reset-password'),
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[400px] flex-col justify-center px-6">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-fg">Reset your password</h1>
      {sent ? (
        <div className="mt-5 rounded-md border border-border bg-canvas-subtle p-4">
          <p className="text-[14px] text-fg">Check your inbox.</p>
          <p className="mt-1 text-[13px] text-fg-muted">
            We sent a reset link to {email}. It expires in one hour.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-5 text-[12px] text-accent hover:underline">
        Back to sign in
      </Link>
    </main>
  );
}
