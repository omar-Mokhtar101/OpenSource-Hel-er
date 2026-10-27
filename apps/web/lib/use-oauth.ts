'use client';

import { useEffect, useState } from 'react';
import { useSupabaseConfig } from '@/components/supabase-provider';
import { githubEnabledFromSettings } from '@/lib/oauth';

/**
 * Supabase reports which OAuth providers are enabled on the project.
 * `null` means "not known yet" — the caller keeps the button disabled.
 *
 * The URL and key come from `SupabaseConfigProvider`, which receives them from
 * the server layout at runtime. Reading `process.env.NEXT_PUBLIC_*` here would
 * be undefined in the Docker standalone build, because those values are inlined
 * only at build time and the image does not bake them.
 */
export function useGitHubOAuthEnabled(): boolean | null {
  const config = useSupabaseConfig();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const url = config?.url;
  const key = config?.anonKey;

  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
    fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: 'no-store',
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((settings: unknown) => {
        if (!alive) return;
        setEnabled(settings ? githubEnabledFromSettings(settings) : null);
      })
      .catch(() => {
        if (alive) setEnabled(null);
      });
    return () => {
      alive = false;
    };
  }, [url, key]);

  return enabled;
}
