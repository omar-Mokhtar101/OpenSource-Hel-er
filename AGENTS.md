# AGENTS.md

## Project

**OpenSource-helper: An AI-Guided Platform That Takes First-Time Developers From Choosing a GitHub Issue to a Merged Pull Request**

OpenSource-helper is a web platform that connects to a developer's GitHub account, learns the developer's skills and experience level, and recommends the three open-source issues that fit them best, with a short explanation of why each one fits. After the developer selects an issue, the platform guides the contribution: it explains the repository and the issue, links learning resources, and offers an AI guide that answers questions without ever writing the solution. It follows the issue through In Progress, PR Open, and Merged by syncing with GitHub. Developers and maintainers can also find active contributors in an organization or repository and send mentorship or recruitment requests. An Admin controls how much AI the platform uses.

## Non-negotiable product rules

- Roles are Developer, Maintainer and Admin; enforce them on every protected operation.
- The AI guide explains, gives investigation steps and points to resources; it must never output a complete solution or implementation code.
- Issue progress is synced from GitHub (In Progress → PR Open → Merged).
- Public profiles and mentor listings are opt-in; outreach recipients can accept, decline or block.
- The Admin controls maximum tokens per user, AI temperature and the AI usage limit.

## Stack (locked)

Decision record: `docs/engineering/decisions/0001-nest-next.md`.

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces, Node 22 |
| Web | Next.js App Router + TypeScript, Tailwind, shadcn/ui, `motion` (animations), TanStack Query, Zod |
| API | NestJS (Express adapter), Prisma, PostgreSQL (Supabase) |
| Auth | Supabase Auth (email + GitHub OAuth). Nest verifies the access token via JWKS |
| Jobs | BullMQ + Redis. Worker entry `apps/api/src/worker.ts` |
| AI | Gemini, server-side only, JSON-schema output + output guardrail |
| GitHub | Octokit. OAuth provider token encrypted at rest (AES-256-GCM) |
| Deploy | Docker images to GHCR; `docker compose` locally |

## Repository map

```
apps/web              Next.js UI + BFF proxy (app/api/[...path]/route.ts)
apps/api              NestJS API, Prisma schema, BullMQ processors
apps/api/src/worker.ts  worker bootstrap (apps/worker/Dockerfile)
packages/contracts    Zod schemas + shared types (single source of API truth)
supabase/             RLS policies and SQL migrations not owned by Prisma
docs/                 requirements, sprints, engineering
```

## Commands

```bash
pnpm install
pnpm dev                     # web :3000 + api :4000
pnpm --filter @osh/api test
pnpm --filter @osh/api exec prisma migrate dev
pnpm --filter @osh/api exec prisma db seed
docker compose up --build    # web + api + worker + redis
```

## Engineering rules

1. **Secrets are server-only.** `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GITHUB_CLIENT_SECRET` and `GITHUB_TOKEN_ENC_KEY` may only appear under `apps/api/**`. Never in `apps/web`, never in `NEXT_PUBLIC_*`.
2. **Authorization lives in services.** Guards are the coarse gate; every owner-scoped read/write re-checks ownership in the service layer.
3. **No business logic in Next.** Route handlers proxy to the API and attach the user's access token. No Prisma in `apps/web`.
4. **Jobs never run in a request.** Anything slower than ~2 s (sync, notifications, CV, AI batches) is a BullMQ job with an idempotency key and bounded retries.
5. **Cron enqueues, the worker works.** `pg_cron`/Actions/cron only add jobs.
6. **Contract first.** Request/response shapes are Zod schemas in `packages/contracts`, used by both sides. Change the contract before the code.
7. **Guardrail is three layers.** System prompt + output post-filter (reject code blocks/diffs) + the eval suite in `docs/Sprints/sprint3/02-testing.md`. A prompt change without a passing eval is not done.
8. **AI limits are enforced server-side**, per user and per feature, before the provider call (FR-20).
9. **Schema changes go through Prisma migrations.** RLS policies go through `supabase/`. Never edit a deployed migration.
10. **No `any`, no string-concatenated SQL, no secret in a log line.** Log `userId`/`requestId`, never tokens.

## Definition of Done (per slice)

- Acceptance criteria for the slice's user story pass.
- Manual checks for that story from `docs/Sprints/sprintN/02-testing.md` run by a human.
- API contract row updated in `docs/API.md` and `docs/Sprints/sprintN/01-api.md`.
- `pnpm lint && pnpm typecheck && pnpm test` pass; `docker compose build` still succeeds.
- Guardrail eval passes if any prompt changed.
- One line added to `docs/learning/journal.md`: what it does, why this way, what would break it.

## Documentation

- `docs/requirements/` — BR/CR, FR-1…FR-20, NFR-1…NFR-6, user stories with acceptance criteria.
- `docs/use-case/use-case-diagram.md` — actors and use-case boundaries.
- `docs/Sprints/README.md` — roadmap, review dashboard, workflow.
- `docs/Sprints/sprintN/00-sprint.md` — scope, stories, acceptance criteria, technical work, DoD.
- `docs/Sprints/sprintN/01-api.md` — endpoint contract + manual API checks.
- `docs/Sprints/sprintN/02-testing.md` — unit, integration, manual, NFR tests.
- `docs/Sprints/sprintN/03-review.md` — acceptance checklist and sign-off.
- `docs/API.md` — global API conventions and links to sprint contracts.
- `docs/design/design.md` — UI/UX source of truth: colour tokens, typography, motion, every screen, copy.
- `docs/engineering/architecture.md` — runtime view, jobs, AI and GitHub pipelines.
- `docs/engineering/decisions/` — one hard-to-reverse decision per file.
- `docs/PROGRESS.md` — the current build order. Start here.
- `docs/learning/` — concept briefs and the explain-back journal.
- `OpenSource-helper_ Project Documentation-2.md` — original specification (reference only, never edit).

## Working notes

- The requirements are the source of truth; do not invent features outside them.
- Keep every change traceable to an FR and a story ID (`US-<FR>.<n>`).
- Prefer a vertical slice that works end to end over two half-built modules.
- If a decision here blocks progress, record the change in `docs/engineering/decisions/` in the same PR.
