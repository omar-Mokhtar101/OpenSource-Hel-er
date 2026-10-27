# Deploying on Vercel (Services + Daemon)

The repository deploys as **one Vercel project** with two services and one daemon.
`vercel.json` is the source of truth; this page explains why it looks the way it
does and what has to be configured outside the repo.

## Topology

```
browser
  │
  ▼
web service (Next.js, public, catches every path)
  │  /api/*  → app/api/[...path]/route.ts (BFF, adds the Supabase access token)
  │
  └── binding API_URL ──► api service (NestJS, internal, no public route)
                              │
                              ├── Supabase Postgres (Prisma)
                              ├── Supabase Storage (CV files)
                              └── Redis (BullMQ) ◄── worker daemon (container)
```

| Piece | Where | Public? | Why |
|---|---|---|---|
| `web` | `apps/web`, Next.js | yes, `/` | UI + the BFF route handlers |
| `api` | `apps/api`, NestJS | **no** | Only the web BFF may call it; a binding grants that access |
| `worker` | `Dockerfile.worker` (repo root), Vercel Daemon | **no** | BullMQ consumers cannot run inside request/response functions |

Two decisions worth remembering:

1. **`/api/*` is not routed to the `api` service.** The browser calls `/api/...`,
   which is the Next.js BFF. The BFF reads the Supabase session cookie and adds
   `Authorization: Bearer <access token>` before forwarding to `API_URL`. Routing
   `/api/*` straight to NestJS would skip that step and every authenticated call
   would arrive without a token.
2. **The worker is a daemon, not a service.** Services answer HTTP requests and
   are scaled per request. CV extraction, GitHub sync, notification delivery and
   account deletion are long-running queue consumers, so they need a process that
   stays alive and pulls work.

## vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "web": {
      "root": "apps/web",
      "framework": "nextjs",
      "bindings": [
        { "type": "service", "service": "api", "format": "url", "env": "API_URL" }
      ]
    },
    "api": { "root": "apps/api", "framework": "nestjs" }
  },
  "rewrites": [{ "source": "/(.*)", "destination": { "service": "web" } }],
  "daemons": {
    "worker": {
      "root": ".",
      "entrypoint": "Dockerfile.worker",
      "instances": { "dub1": 1 }
    }
  }
}
```

- `web.bindings` is the **caller-side** grant. Vercel injects the internal URL of
  the `api` service into `API_URL` at runtime. **Do not set `API_URL` yourself on
  Vercel** — a manual value overrides the binding. (Docker Compose still sets
  `API_URL=http://api:4000` for local runs; that is the same variable, different
  environment.)
- Bindings resolve at runtime in functions only. Nothing may call `API_URL`
  during `next build`; all API-reading pages are `force-dynamic` for that reason.
- The daemon's `root` is the repo root because its Docker build context must
  contain the whole pnpm workspace. Vercel refuses a `Dockerfile` whose directory
  is the daemon `root` when that would collide with an output directory, hence the
  suffixed `Dockerfile.worker` at the root instead of `apps/worker/Dockerfile`.

## Environment variables

Vercel environment variables are project-wide: every service and the daemon see
the same set. There is no per-service scoping yet, so `SUPABASE_SERVICE_ROLE_KEY`
and `GEMINI_API_KEY` are technically present in the web function's environment.
No web code reads them (rule 1 in `AGENTS.md` still holds in the code), but it is
worth knowing.

Set these in **Project → Settings → Environment Variables** (Production, and
Preview if you use preview deployments):

| Variable | web | api | worker | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ | `https://<ref>.supabase.co`, no `/rest/v1` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ | publishable/anon key, safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | | ✓ | ✓ | server-only; never `NEXT_PUBLIC_*` |
| `DATABASE_URL` | | ✓ | ✓ | Supabase transaction pooler `:6543`, `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | | ✓ | ✓ | Supabase session pooler `:5432` (migrations/debug) |
| `REDIS_URL` | | ✓ | ✓ | managed Redis over TCP; Upstash free tier works |
| `GEMINI_API_KEY` | | ✓ | ✓ | optional; without it CV extraction falls back to rules |
| `GEMINI_MODEL` | | ✓ | ✓ | defaults to `gemini-2.5-flash` |
| `GITHUB_TOKEN_ENC_KEY` | | ✓ | ✓ | 32-byte key, base64/hex; encrypts the OAuth provider token |
| `SUPABASE_JWKS_URL` | | ✓ | | optional override of the JWKS endpoint |
| `STORAGE_BUCKET` | | ✓ | ✓ | defaults to `cvs` |
| `NEXT_PUBLIC_APP_URL` | ✓ | | | `https://<project>.vercel.app`; falls back to `VERCEL_PROJECT_PRODUCTION_URL` |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | | ✓ | ✓ | only if email delivery is enabled |
| `AUTH_DEV_MODE` | | ✓ | | keep unset/false in production |
| `API_URL` | — | — | — | **injected by the binding**, never set by hand |

`PORT` is provided by Vercel. `NODE_ENV=production` is set by the platform.

## First deployment

1. **Redis.** Create an Upstash Redis database (free tier) in the same region as
   Supabase and copy the **TCP** URL (`rediss://...`). The REST URL will not work
   with BullMQ/ioredis.
2. **Database.** Use the Supabase pooler strings from `.env.example`. Apply the
   schema from your machine — never from a Vercel build, which runs per service
   and would race:
   ```bash
   DATABASE_URL=... DIRECT_URL=... pnpm db:deploy
   ```
   Optionally seed the demo accounts: `pnpm db:seed`.
3. **Import the repo.** Vercel → Add New → Project → choose the fork. Leave
   **Root Directory** empty (the repo root). Do not pick `apps/web`: services and
   daemons are declared at the project root.
4. **Add the environment variables** from the table above.
5. **Region.** Functions default to `iad1`. Pick the region closest to the
   Supabase project (for `eu-west-1`, use `dub1`) in
   **Project → Settings → Functions → Region**, and keep the daemon's
   `instances` region in `vercel.json` aligned.
6. **Supabase redirect URLs.** Authentication → URL Configuration:
   - Site URL: `https://<project>.vercel.app`
   - Redirect URLs: `https://<project>.vercel.app/auth/callback`
   - Add `https://<project>.vercel.app/**` only if you rely on `?next=` paths.
   The GitHub OAuth app's callback stays
   `https://<ref>.supabase.co/auth/v1/callback`.
7. **Deploy.** The first build compiles `apps/web`, then `apps/api`, then the
   worker image.

## Verify a deployment

| Check | Expected |
|---|---|
| `https://<project>.vercel.app/api/health` | `{"status":"ok","service":"osh-api",...}` — proves web → BFF → api binding works |
| `/login` | **Continue with GitHub** is visible and enabled |
| Sign in with email | lands on `/discover`; the profile loads |
| `Settings → Account` | GitHub shows **Connected** after the OAuth round trip |
| CV upload | status PENDING → PROCESSING → COMPLETED |
| Vercel logs, `source:daemon` | `worker started with 8 queues` |
| GitHub progress | **Sync** on the progress board updates states |

The first three only exercise the services. CV uploads and sync also prove the
daemon and Redis are wired.

## Limits that shaped the code

| Vercel limit | Effect here |
|---|---|
| 4.5 MB request/response body | `CV_MAX_BYTES` is **4 MB** (was 5 MB). A 5 MB file would be rejected by the platform with an opaque 413 before our validation ran. |
| 300 s function duration (Hobby) | Anything slower is a queue job, which is already the architecture rule. |
| No persistent process in functions | BullMQ consumers moved to the daemon; `@nestjs/schedule` in the API is best-effort on serverless. |
| 250 MB function bundle | NestJS + Prisma + Octokit fit; check the build log if it grows. |

### Scheduled work

`SchedulerService` still runs inside the API function, but a serverless function
only lives while it is being used, so do not expect the 5/15-minute jobs to fire
like a cron. The in-app **Sync** button (`POST /selection/sync`) enqueues the same
job on demand and is the reliable path for the demo.

If periodic sync has to be guaranteed later, add a `crons` entry plus a protected
`/api/cron/*` route. That needs a public rewrite for the cron path and a
`CRON_SECRET` check, so it is deliberately not part of this change.

## Local development against this config

```bash
vercel dev   # runs web + api, injects bindings; daemons are skipped
```

Daemons do not run in `vercel dev` or in preview deployments. Use the existing
`docker compose up --build` for the full stack, or build the daemon image
directly:

```bash
docker build -f Dockerfile.worker -t osh-worker .
docker run --rm --env-file .env osh-worker
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `/api/health` returns 503 `API_UNAVAILABLE` | `api` service failed to build/start, or the binding is missing on `web` |
| Every API call is 401 | `API_URL` was set manually (bypassing the binding) or the route is hitting the API directly without the BFF |
| `Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x"` | `prisma generate` did not run in the build, or `binaryTargets` lost `rhel-openssl-3.0.x` |
| Upload fails with 413 `FUNCTION_PAYLOAD_TOO_LARGE` | file over 4.5 MB; the app caps at 4 MB, so this means the cap was bypassed |
| CV stays `PENDING`, no worker logs | daemon not running (preview deployment, instances set to 0, or Redis unreachable) |
| `Cannot find module 'unpdf'` in the API logs | the function bundler did not trace the ESM-only parser; add it to the service's `functions.includeFiles` |
| GitHub button hidden | Supabase `/auth/v1/settings` reports the provider disabled, or the runtime config reached the client as empty |
