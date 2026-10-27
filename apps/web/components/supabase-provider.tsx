'use client';

import { createBrowserClient } from '@supabase/ssr';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const SupabaseContext = createContext<SupabaseConfig | null>(null);

export function SupabaseConfigProvider({
  url,
  anonKey,
  children,
}: SupabaseConfig & { children: ReactNode }) {
  return (
    <SupabaseContext.Provider value={{ url, anonKey }}>{children}</SupabaseContext.Provider>
  );
}

/**
 * The runtime config the server layout injected. Returns `null` when the build
 * had no Supabase env, so callers can degrade instead of crashing.
 */
export function useSupabaseConfig(): SupabaseConfig | null {
  return useContext(SupabaseContext);
}

export function useSupabase() {
  const config = useSupabaseConfig();
  if (!config || !config.url || !config.anonKey) {
    throw new Error('Supabase is not configured. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return useMemo(() => createBrowserClient(config.url, config.anonKey), [config.url, config.anonKey]);
}
