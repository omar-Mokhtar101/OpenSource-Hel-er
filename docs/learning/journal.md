# Learning journal

One line per slice: what it does, why this way, what would break it.

- **Slice 0 — setup:** installed Node/pnpm user-locally and reached Docker
  through `sg docker`; why: no sudo password, and credentials must be verified
  without printing them; what breaks it: a shell that cannot join the docker
  group or a paused Supabase project.
- **Slice 1 — workspace/containers:** one pnpm workspace with Zod contracts,
  a Nest health API and a Next shell, all in multi-stage images; why: contract
  first and a runnable system per slice; what breaks it: a lockfile/source copy
  mismatch in the Docker deps stage or a runtime `NEXT_PUBLIC_*` value baked at
  build time.
- **Slice 2 — identity/profile:** Supabase Auth + JWKS, role guards, ownership,
  normalized skills/languages and a CV job; why: every later feature depends on
  a trustworthy user and a complete profile; what breaks it: a pooler/direct URL
  swap, an empty optional env var, or a PDF library that cannot read the file.
- **Slice 3 — discovery/ranking:** a shared cached GitHub pool and an AI
  ranking that must always return three issues; why: search quota is the
  tightest free limit and no request may depend on AI; what breaks it: a model
  that exceeds the 10s budget, an unbounded retry, or per-user searches.
- **Slice 4 — onboarding/guide/progress:** cached onboarding, a refusal-first
  guide with an output filter, and a 5-minute sync; why: the product promise is
  “explained, not solved”, and stale progress is worse than manual progress;
  what breaks it: generating onboarding inline in a chat request, attributing a
  stranger's PR when `githubLogin` is null, or a filter that only strips fences.
- **Slice 5 — notifications/gamification/admin:** deduped in-app notifications,
  rules-based badges/streaks and a five-minute metrics cache; why: in-app is the
  record and a repeated job must not spam; what breaks it: a missing dedupe key,
  an email failure blocking the event, or an Admin route without a role gate.
- **Slice 6 — community/public/learning:** opt-in public profiles, public GitHub
  contributor search, outreach with block rules and public guides; why: privacy
  by omission and free public data only; what breaks it: publishing by default,
  a private profile returning data in the 404 path, or a contributor search that
  ignores rate limits.
- **Slice 7 — release/docs:** compose with a local Postgres and migrate service,
  PM1 diagrams, traceability and this handbook; why: a clean machine must run
  one command and a reviewer must follow the mapping without asking; what breaks
  it: a diagram that is not backed by a file, a secret in a tracked file, or a
  demo that depends on a paused free project.
- **UX pass — context before AI:** every issue page loads a deterministic
  context (issue text, comments, README, CONTRIBUTING, clone/branch/test
  commands) before the AI onboarding; why: a beginner must understand the
  repository without waiting for a model, and the guide should explain, not
  replace, the source; what breaks it: a GitHub 503 with no fallback link, a
  command list that ignores the lockfile, or AI text presented as the source of
  truth.
- **Progress board:** cards move between In Progress, PR Open, Merged and Paused
  by drag or dialog; every transition writes an event, an in-app notification
  and a badge job, and Merged is terminal; why: status must be legible at a
  glance and auditable; what breaks it: allowing a merged card to move back, a
  drop that writes no event, or a notification without a dedupe key.
- **Profile form hydration:** state is seeded once during render, not in an
  effect; why: the first click on a language raced the profile effect and was
  overwritten; what breaks it: re-adding a `useEffect` that resets the form on
  every `profile.data` change.
- **Release — one image per service:** `web`, `api` and `worker` each build from
  their own multi-stage `apps/<service>/Dockerfile`; why: PM1 asks for a
  Dockerfile per service, and separate images keep the entrypoint explicit;
  what breaks it: drifting build stages between `apps/api` and `apps/worker`
  (keep them in sync) or a worker image that exposes an HTTP healthcheck.
- **OAuth detection reads runtime config, not build-time env:** the GitHub button
  asks Supabase `/auth/v1/settings` using the URL and key that
  `SupabaseConfigProvider` receives from the server layout; why: `NEXT_PUBLIC_*`
  is inlined at build time and the Docker image builds without it, so
  `process.env` was undefined and the button was hidden even with the provider
  enabled; what breaks it: reading `process.env.NEXT_PUBLIC_*` inside a client
  component again, or dropping the provider props from `app/layout.tsx`.
- **GitHub Dark is the default palette:** `lib/theme.ts` holds `DEFAULT_THEME` and
  the toggle cycle (github → dark → light → github); why: the product looks
  closest to the tool developers already use, and light stays one click away;
  what breaks it: changing `defaultTheme` without updating `lib/theme.test.ts`,
  or a theme whose tokens drift from `app/globals.css`.
- **Vercel runs the app as two services and a daemon:** `vercel.json` puts
  `apps/web` and `apps/api` under `services`, exposes only `web`, and gives
  `web` a service binding that injects `API_URL`; the BullMQ consumer runs as a
  daemon built from the root `Dockerfile.worker`; why: `/api/*` must stay on the
  Next BFF because that is where the Supabase access token is attached, and a
  queue consumer cannot live inside a request/response function; what breaks it:
  routing `/api` straight to the API (every call becomes 401), setting `API_URL`
  by hand on Vercel (it overrides the binding), or moving the daemon Dockerfile
  into `apps/worker` where the build context loses the workspace.
- **CV upload cap is 4 MB, not 5:** Vercel Functions reject bodies over 4.5 MB
  and the browser upload passes through the web function before the API; why:
  a bigger file would fail at the platform with an opaque 413 before our own
  validation; what breaks it: raising `CV_MAX_BYTES` above 4 MB without moving
  uploads to direct-to-Supabase signed URLs.
- **Middleware runs on the Node runtime:** `apps/web/middleware.ts` sets
  `runtime: 'nodejs'`; why: Next.js 15 defaults middleware to Edge, and Vercel
  Services refuse a deployment that contains any Edge Function output, while
  middleware is the only place the Supabase session cookie can be refreshed;
  what breaks it: removing that line (the build dies at "Deploying outputs") or
  deleting the middleware (server components cannot write cookies, so sessions
  stop refreshing and users are signed out when the access token expires).
