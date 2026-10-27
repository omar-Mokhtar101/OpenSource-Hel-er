# Build Progress

The order to build in. Tick a slice only when its "done when" is true. Keep this file short — detail lives in the sprint files.

**Status:** all slices shipped; the golden path runs in `docker compose`. Slice 10 is code-complete; only the human rehearsal and backup video remain.

## Rules

- One slice at a time; a slice ends with a runnable system.
- Every slice has a manual check a human runs.
- Stop coding 3 hours before the demo and switch to regression + rehearsal.

## Slice 1 — Workspace and containers

- [x] pnpm workspace: `apps/web`, `apps/api`, `packages/contracts`
- [x] `apps/api` Nest app with `/health`, global validation pipe, error filter
- [x] `apps/web` Next app with layout, theme tokens, one animated page
- [x] `Dockerfile` per service, `docker-compose.yml` with `web`, `api`, `worker`, `redis`
- [x] `ci.yml` green, `docker.yml` pushes three images (`web`, `api`, `worker`) to GHCR

**Done when:** `docker compose up --build` serves the web app, `/health` returns ok, and a push to `main` publishes two GHCR tags.

## Slice 2 — Database and identity

- [x] Prisma schema: `users`, `profiles`, `user_skills`, `user_languages`, `ai_settings`
- [x] Supabase project wired (email + GitHub providers), access token verified in Nest via JWKS
- [x] `JwtAuthGuard` + `RolesGuard` + `@CurrentUser()`
- [x] Seed: Developer, Maintainer, Admin

**Done when:** M1.1, M1.2, M1.4, M1.5, M1.8 pass from `sprint1/02-testing.md`.

## Slice 3 — Profile and AI settings

- [x] Profile read/update, skills, level, languages, username uniqueness
- [x] Admin AI settings read/update with validation
- [x] Profile-completeness gate for recommendations

**Done when:** M1.9, M1.10, M1.14 pass.

## Slice 4 — GitHub discovery

- [x] Octokit client, encrypted token storage, connect/disconnect
- [x] Shared candidate pool by language/label/activity, cached
- [x] Filters, exclusions (closed, assigned, inactive, selected, ignored), empty state

**Done when:** M2.1–M2.5 pass, and two searches within the TTL hit the cache (log proof).

## Slice 5 — Ranking and selection

- [x] Gemini rank endpoint, JSON schema, id validation, deterministic fallback
- [x] Three recommendation cards with reason, details view, regenerate
- [x] Confirm/cancel selection, ignore list
- [x] AI usage row written before every provider call

**Done when:** M2.6–M2.11, M2.14 pass; a forced Gemini timeout still returns three ranked issues.

## Slice 6 — Onboarding and AI guide

- [x] Repository onboarding (cached per repo + commit), issue onboarding
- [x] Chat with history and streaming
- [x] Guardrail: prompt + post-filter
- [x] Guardrail eval suite from `sprint3/02-testing.md`

**Done when:** M3.1–M3.12 pass and the guardrail suite is 100% refusal.

## Slice 7 — Progress and sync

- [x] Progress dashboard, manual status, PR link
- [x] `github.sync.progress` BullMQ job + worker bootstrap, 5-minute schedule
- [x] Status history with source (`manual` / `sync`)

**Done when:** opening a PR flips the status to PR Open within 5 minutes; merging flips to Merged; a replayed event creates no duplicate row.

## Slice 8 — Notifications and admin

- [x] In-app notifications + read state + preferences
- [x] Admin metrics (users, suggested/regenerated, status counts)
- [x] AI usage totals with period filter, ≤5 min freshness

**Done when:** M4.4, M4.5, M4.12, M4.13 pass.

## Slice 9 — Breadth (visible, honest)

- [x] Saved items and lists
- [x] Badges and streaks (rules in code, seeded awards)
- [x] Public profile with visibility toggles + OG tags
- [x] Contributor search + outreach request
- [x] Learning resources with topic search

**Done when:** every remaining FR has a reachable screen backed by real or clearly seeded data; anything unfinished is labelled "preview" in the UI.

## Slice 10 — Release

- [x] Full manual regression from Sprints 1–5 (golden path in full, others sampled)
- [x] Seed script that builds the demo account end to end
- [ ] Backup video of the golden path (human to record)
- [x] `docs/DEMO.md` finalized; **rehearsed twice by the human — pending**

**Done when:** a clean machine can run `docker compose up --build`, log in as the seeded Developer, and complete the golden path without manual fixes.

## Demo script source

`docs/DEMO.md` — sign up → profile → three recommendations → select → onboarding → AI guide refusal → progress → merged → admin usage.


## Evidence

- Feature docs: `docs/features/README.md`
- Architecture and diagrams: `docs/engineering/diagrams/`
- API contracts: `docs/API.md` and each `docs/Sprints/sprintN/01-api.md`
- Guardrail eval: `pnpm guardrail:eval` → 10/10
- Integration: `pnpm --filter @osh/api test:integration -- --runInBand` → 13/13
- Live smoke: `pnpm smoke` and the Bruno smoke collection (8/8)
- Compose: `docker compose ps` shows api, web, worker healthy; postgres/redis healthy
- CI: all 7 jobs green on PR #2 (run 40461265525); guardrail eval green (run 40461265486)
- PR/review: see `dev/STATE.md` and `dev/build-log.md`
