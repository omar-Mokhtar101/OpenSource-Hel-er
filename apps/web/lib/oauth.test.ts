import { describe, expect, it } from 'vitest';
import { githubEnabledFromSettings, friendlyOAuthError } from './oauth';

describe('githubEnabledFromSettings', () => {
  it('reads the github flag from the Supabase auth settings payload', () => {
    expect(githubEnabledFromSettings({ external: { github: true, email: true } })).toBe(true);
  });

  it('returns false when the provider is disabled', () => {
    expect(githubEnabledFromSettings({ external: { github: false, email: true } })).toBe(false);
  });

  it('returns false for a missing or malformed payload', () => {
    expect(githubEnabledFromSettings(null)).toBe(false);
    expect(githubEnabledFromSettings({})).toBe(false);
    expect(githubEnabledFromSettings('not json')).toBe(false);
  });
});

describe('friendlyOAuthError', () => {
  it('explains a provider that is not enabled', () => {
    expect(
      friendlyOAuthError('Unsupported provider: provider is not enabled'),
    ).toMatch(/is not enabled on this Supabase project/);
  });

  it('explains a redirect URL mismatch', () => {
    expect(friendlyOAuthError('redirect_uri_mismatch')).toMatch(/redirect allow-list/);
  });

  it('passes any other error through unchanged', () => {
    expect(friendlyOAuthError('Network down')).toBe('Network down');
  });
});
