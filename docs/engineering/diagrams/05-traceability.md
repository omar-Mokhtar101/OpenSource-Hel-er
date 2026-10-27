# 05 — Design → code traceability

Every diagram element maps to a real artifact. Jira keys come from
`docs/Sprints/jira-import.csv` (62 stories, 219 points).

## Level 0 — actors, system, interfaces

| Diagram element | Artifact | FR / story |
|---|---|---|
| Developer | `Role.DEVELOPER`, demo `dev@osh.dev` | FR-2, FR-4–FR-12, FR-14–FR-18 |
| Maintainer | `Role.MAINTAINER`, demo `maintainer@osh.dev` | FR-17, FR-18 |
| Admin | `Role.ADMIN`, demo `admin@osh.dev` | FR-19, FR-20 |
| IWeb | `apps/web/app/**`, `components/**` | FR-1–FR-20 |
| IApi | `apps/api/src/modules/*` controllers | FR-1–FR-20 |
| IGitHub | `apps/api/src/modules/github/github.service.ts` | FR-4, FR-5, FR-7–FR-10, FR-17 |
| ISupabase | `apps/api/src/auth/supabase-jwt.service.ts`, `infra/storage.service.ts`, `prisma/schema.prisma` | FR-1, FR-3, all data |
| IEmail | `apps/api/src/infra/email.service.ts` | FR-1.9, FR-13, FR-18 |
| ICVParser | `apps/api/src/modules/cv/cv.parser.ts` (`unpdf`/`mammoth`) | FR-3 |
| ILLM | `apps/api/src/modules/ai/gemini.service.ts` | FR-3, FR-5, FR-9–FR-11 |
| web | `apps/web/Dockerfile`, `app/api/[...path]/route.ts` | NFR-3, NFR-1 |
| api | `apps/api/Dockerfile`, `src/main.ts` | NFR-1, NFR-3 |
| worker | `apps/worker/Dockerfile`, `src/worker.ts`, `src/jobs/worker-runner.ts` | NFR-5, FR-3/7/8/13/16 |
| Redis | `src/infra/redis.service.ts`, `queue.service.ts`, `04-redis-keys.md` | NFR-1, FR-4/5/13 |
| Postgres | `prisma/schema.prisma`, `04-erd.md` | all FRs |
| migrate | `apps/api/prisma/migrations/20261026232106_init`, compose `migrate` | NFR-2.2 |

## Level 1 — containers and protocols

| Element | Artifact |
|---|---|
| Browser → web session | `apps/web/middleware.ts`, `lib/supabase/server.ts` |
| web → api Bearer proxy | `apps/web/app/api/[...path]/route.ts` |
| api → Postgres | `src/prisma/prisma.service.ts` |
| api/worker → Redis | `src/infra/redis.service.ts`, `src/infra/queue.service.ts` |
| api/worker → GitHub | `src/modules/github/github.service.ts` |
| api/worker → Supabase Storage | `src/infra/storage.service.ts` |
| api/worker → Gemini | `src/modules/ai/gemini.service.ts` |
| api/worker → Resend | `src/infra/email.service.ts` |
| health checks | `docker-compose.yml`, `src/health.controller.ts` |
| GHCR | `.github/workflows/docker.yml` |
| CI | `.github/workflows/ci.yml` |

## Level 2 — components

| Component | File | Tests |
|---|---|---|
| Auth guard | `src/auth/jwt-auth.guard.ts` | integration 401/403 |
| Roles guard | `src/auth/roles.guard.ts` | integration Developer 403 |
| Profile | `src/modules/profile/profile.service.ts` | integration profile + validation |
| CV | `src/modules/cv/*` | live PDF pipeline; guardrail unit |
| Github | `src/modules/github/github.service.ts` | live search/contributors |
| Discovery | `src/modules/discovery/*` | live ranking + fallback |
| Selection | `src/modules/selection/*` | integration side effect |
| Saved | `src/modules/saved/*` | live UI |
| Onboarding | `src/modules/onboarding/*` | live repo/issue content |
| Guide | `src/modules/guide/*`, `ai/guardrail*` | 13 unit + 10 eval |
| Notifications | `src/modules/notifications/*` | integration ownership |
| Achievements | `src/modules/achievements/*` | live page |
| Public profile | `src/modules/public-profile/*` | live `/u/sam` |
| Community | `src/modules/community/*` | live search |
| Outreach | `src/modules/outreach/*` | service rules; demo path |
| Learning | `src/modules/learning/*` | public smoke |
| Admin | `src/modules/admin/*` | integration metrics |
| Scheduler/worker | `src/jobs/*` | worker logs in compose |
| BFF | `apps/web/app/api/[...path]/route.ts` | live browser login |
| Web pages | `apps/web/app/**` | browser screenshots in `dev/evidence/` |

## Level 3 — classes

The class diagrams map one-to-one to files in
`03-class-api.md` and `03-class-web.md`. No diagram class lacks a file.

## Progress state machine

The contribution lifecycle (In Progress → PR Open → Merged, plus Paused) is in
[`06-progress-state.md`](06-progress-state.md). The board is
`apps/web/app/(app)/progress/page.tsx`; transitions are enforced in
`SelectionService.update`.

## ERD / Redis

Every entity in `04-erd.md` exists in `schema.prisma`. Every Redis key in
`04-redis-keys.md` exists in `GithubService` or `AdminService`.

## Jira mapping

| FR | Jira prefix | Sprint |
|---|---|---|
| FR-1, 2, 3, 14, 20, 13 | OSH-1…OSH-14 | 1 |
| FR-4, 5, 6, 7, 20 | OSH-15…OSH-27 | 2 |
| FR-8, 9, 10, 11 | OSH-28…OSH-39 | 3 |
| FR-7, 8, 13, 14, 16, 19 | OSH-40…OSH-50 | 4 |
| FR-12, 15, 17, 18, 20 | OSH-51…OSH-62 | 5 |

## Rule

A diagram element without a row here is either removed or given a row in the
same PR. A row without code is a documentation bug.
