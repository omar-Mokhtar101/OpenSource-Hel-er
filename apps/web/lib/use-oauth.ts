'use client';

import { useEffect, useState } from 'react';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase reports which OAuth providers are enabled on the project.
 * `null` means "unknown yet" — render the button and let the provider answer.
 */
export function useGitHubOAuthEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!URL || !KEY) {
      setEnabled(false);
      return;
    }
    let alive = true;
    fetch(`${URL.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: KEY },
      cache: 'no-store',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: { external?: Record<string, boolean> } | null) => {
        if (alive) setEnabled(Boolean(settings?.external?.github));
      })
      .catch(() => {
        if (alive) setEnabled(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  return enabled;
}

export function friendlyOAuthError(message: string): string {
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return 'GitHub sign-in is not enabled on this Supabase project yet. Use email and password below, or ask the project owner to enable the GitHub provider.';
  }
  if (/redirect_uri|redirect url/i.test(message)) {
    return 'GitHub sign-in is misconfigured: add /auth/callback to the Supabase redirect allow-list.';
  }
  return message;
}
