export const SITE_NAME = 'OpenPath';
export const SITE_DESCRIPTION =
  'Open-source issues matched to your skills, explained step by step, guided to a merged pull request — without anyone writing the code for you.';

/**
 * Public origin of the web app, used for absolute links (metadata, share URLs).
 *
 * Order: an explicit NEXT_PUBLIC_APP_URL wins (local Docker, custom domain),
 * then Vercel's own production URL (no scheme, and it covers preview
 * deployments' production alias), then localhost. Server-side only.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
