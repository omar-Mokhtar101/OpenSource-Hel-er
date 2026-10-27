export interface SupabaseAuthSettings {
  external?: Record<string, boolean> | null;
}

/**
 * Supabase's public `/auth/v1/settings` reports which providers are enabled.
 * Anything unexpected means "not enabled" so the caller hides the button.
 */
export function githubEnabledFromSettings(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const external = (settings as SupabaseAuthSettings).external;
  return Boolean(external && external.github);
}

export function friendlyOAuthError(message: string): string {
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return 'GitHub sign-in is not enabled on this Supabase project yet. Use email and password below, or ask the project owner to enable the GitHub provider.';
  }
  if (/redirect_uri|redirect url/i.test(message)) {
    return 'GitHub sign-in is misconfigured: add the callback URL to the Supabase redirect allow-list.';
  }
  return message;
}
