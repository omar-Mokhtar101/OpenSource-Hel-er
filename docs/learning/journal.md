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
- **Release — one image per service:** `web`, `api` and `worker` each build from
  their own multi-stage `apps/<service>/Dockerfile`; why: PM1 asks for a
  Dockerfile per service, and separate images keep the entrypoint explicit;
  what breaks it: drifting build stages between `apps/api` and `apps/worker`
  (keep them in sync) or a worker image that exposes an HTTP healthcheck.
