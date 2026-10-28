# OpenPath

An AI-guided platform that takes a first-time developer from choosing a GitHub
issue to a merged pull request. Issues are matched to skills, explained step by
step, and tracked from In Progress to PR Open to Merged. The guide never writes
the solution.

**Live demo:** `http://localhost:3000` after the quick start.

## Stack

pnpm workspace · Next.js 15 (App Router, Tailwind, TanStack Query, Zod) ·
NestJS 11 · Prisma + PostgreSQL · Redis + BullMQ · Supabase Auth/Storage ·
Gemini · Octokit. Separate `web`, `api` and `worker` images.

## Quick start

Prerequisites: Node 22, pnpm 9, Docker + Compose, and a free Supabase project
(see `dev/SETUP/01-supabase.md`). No paid service and no card.

```bash
cp .env.example .env          # fill it locally; never commit it
pnpm install
pnpm verify:env               # PASS/FAIL only; never prints a value
docker compose up --build     # web + api + worker + redis + postgres + migrate
pnpm db:seed                  # demo accounts, skills, badges, learning content
```

Open <http://localhost:3000>. Sign in as `dev@osh.dev` (password:
`SEED_PASSWORD`, default `OpenSource!2026`; change it).

For hot reload instead of containers:

```bash
./scripts/dev-services.sh up  # local Postgres + Redis
pnpm db:deploy && pnpm db:seed
pnpm dev                      # web :3000 + api :4000
pnpm dev:worker               # second terminal
```

## Golden path

Sign up → profile → three recommendations → select → onboarding → AI guide
refusal → progress → merged → admin usage. The exact steps, accounts and
fallbacks are in [`docs/DEMO.md`](docs/DEMO.md).

## Tests and checks

```bash
pnpm check                         # lint + typecheck + unit
pnpm --filter @osh/api test:integration -- --runInBand
pnpm guardrail:eval                # 100% refusal fixture suite
pnpm smoke                         # live web + api + roles
pnpm check:secrets                 # before every push
```

Integration tests use a local `osh_test` database, never Supabase. The scoped script applies the migration first:
`pnpm --filter @osh/api test:integration -- --runInBand`.

## Deploy on Vercel

The repo ships a `vercel.json` with two services (`web` public, `api` internal)
and one daemon (`worker`). The web BFF reaches the API over a service binding, so
`/api/*` stays on Next.js. External pieces you must provide: Supabase (database,
auth, storage) and a Redis with TCP (Upstash free tier).

Full setup, environment matrix and limits:
[`docs/engineering/deployment-vercel.md`](docs/engineering/deployment-vercel.md).

```bash
vercel dev             # web + api locally, bindings injected (no daemon)
docker compose up -d   # full stack including the worker
```

## Repository map

```text
apps/web          Next.js UI and same-origin BFF proxy
apps/api          NestJS API, Prisma schema, BullMQ processors
apps/api/src/worker.ts  worker bootstrap (apps/worker/Dockerfile)
packages/contracts  Zod request/response schemas (source of API truth)
supabase/         RLS policies and SQL migrations not owned by Prisma
docs/             requirements, sprint contracts, design, ADRs, features, PM1
dev/              untracked setup kit, state, build log and evidence
.github/          CI, GHCR publish, PR template
scripts/          setup, verify, seed, smoke, compose, Jira/Bruno generators
.bruno/           every endpoint as a runnable request
```

## Documentation

- [`docs/HANDBOOK.md`](docs/HANDBOOK.md) — 45-minute tour.
- [`docs/features/README.md`](docs/features/README.md) — one document per FR.
- [`docs/engineering/diagrams/00-context.md`](docs/engineering/diagrams/00-context.md) — design diagrams.
- [`docs/engineering/decisions/`](docs/engineering/decisions/) — ADRs 0001–0006.
- [`docs/Sprints/`](docs/Sprints/) — sprint scope, contracts, tests, velocity.
- [`docs/PM1.md`](docs/PM1.md) — PM1 checklist with real artifacts.
- [`dev/README.md`](dev/README.md) — 30-minute credential setup (untracked).

## Security

Secrets live only in `apps/api` runtime env. The web app never reads a service
key. GitHub provider tokens are AES-256-GCM encrypted at rest. JWTs are verified
by JWKS; roles come from `users.role`; ownership is re-checked in services.
Uploads are private, size/type checked. The AI guide is prompt + output filter +
eval, and refuses to write the implementation.

## Product rules

Roles: Developer, Maintainer, Admin. Runtime externals: GitHub, Supabase,
Email, CV parser (in-process), LLM. Free plans only. `AGENTS.md` is the
non-negotiable engineering contract.

## License and ownership

Course project, CSE454. See the original specification at the repository root
(reference only).
