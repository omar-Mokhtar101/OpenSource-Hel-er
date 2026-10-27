# Handbook — OpenSource-helper in under 45 minutes

A reading order for a new engineer, reviewer or demo judge. Every section links
to the artifact, not a summary of it.

## 0. The 10-minute tour (10 min)

1. `README.md` — what it is, the stack and the one-command run.
2. `docs/PROGRESS.md` — the build order and what is shipped.
3. `docs/features/README.md` — one row per FR; open FR-1, FR-5, FR-11 and
   FR-20 as the representative slices.
4. `docs/design/design.md` — the UI source of truth; the home page is the
   product promise.
5. `docs/DEMO.md` — the golden path you will see.

## 1. Actors and use cases (3 min)

Three roles: Developer, Maintainer, Admin. The five runtime external systems are
GitHub, Supabase, Email, CV Parser (in-process) and the LLM. Jira is PM1-only.
Read `docs/use-case/use-case-diagram.md` and
`docs/engineering/diagrams/00-context.md`.

## 2. Runtime topology (4 min)

```text
browser → web :3000 (session cookie, BFF) → api :4000 (guards, services)
                                            ├─ Postgres (Prisma)
                                            ├─ Redis (queue + cache)
                                            ├─ GitHub / Gemini / Resend
                                            └─ Supabase Auth + Storage
worker ← Redis → Postgres / GitHub / Gemini / Resend
```

Read `docs/engineering/diagrams/01-containers.md` and
`docs/engineering/runtime-flows.md`.

## 3. Request lifecycle (5 min)

1. `apps/web/middleware.ts` refreshes the Supabase session.
2. `apps/web/app/api/[...path]/route.ts` proxies to the API with a Bearer token.
3. `apps/api/src/auth/jwt-auth.guard.ts` verifies ES256 JWKS.
4. `roles.guard.ts` checks the role from `users.role`.
5. The service re-checks ownership, applies rules, calls a provider only when
   needed.
6. The response matches a Zod schema in `packages/contracts`.
7. The web parses the same schema and renders.

Every click path is traced in `docs/features/FR-*/`.

## 4. Data model (4 min)

`docs/engineering/diagrams/04-erd.md` and
`docs/engineering/data-model.md`. One database, one owner; the worker shares it
because it is the same service. Unique keys are the idempotency guarantees.

## 5. Jobs and sync (3 min)

Cron enqueues, the worker works. Read `02-components-worker.md` and
`sequences/06-progress-sync.md`. The 5-minute sync is the product's freshness
contract (NFR-5.1). A user without a connected GitHub login never gets a
stranger's PR attributed to them.

## 6. AI pipeline and guardrail (5 min)

`docs/features/FR-11-ai-guide.md` and
`apps/api/src/modules/ai/`:

- system prompt (`prompts.ts`) + structured JSON for ranking/onboarding;
- intent refusal before the provider call;
- output post-filter (`guardrail.service.ts`) that strips fences/diffs/code;
- eval suite (`guardrail.cases.ts`, `guardrail.eval.ts`, 10/10);
- usage rows before the response, per-user and platform limits enforced first.

## 7. GitHub pipeline (3 min)

`GithubService`: cache the shared pool, never search per user per request;
repo context per repo/commit; contributor data per repo; rate limits return
stale cache. Read `04-redis-keys.md`.

## 8. Auth and authorization (2 min)

JWKS verification, roles from the database, ownership in services, RLS as the
second line. ADR 0002 removes the GitHub client secret from the API runtime.

## 9. Decisions index (2 min)

| ADR | Decision |
|---|---|
| 0001 | Nest + Next monorepo |
| 0002 | Supabase-managed GitHub OAuth |
| 0003 | Worker shares the API database |
| 0004 | In-process CV parsing |
| 0005 | Redis local in Docker |
| 0006 | Local Postgres demo, Supabase dev/production |

## 10. Feature index (1 min)

`docs/features/README.md` — 20 rows, each with story, sprint, status and known
limits. Open the feature before the code; it names the files, contract, tests
and demo.

## 11. Run it (2 min)

```bash
cp .env.example .env          # fill locally
./scripts/docker-up.sh        # web, api, worker, redis, postgres, migrate
pnpm db:seed                  # demo accounts + content
# open http://localhost:3000, sign in as dev@osh.dev
```

Or `pnpm dev` for hot reload. `pnpm verify:env` proves the integrations;
`pnpm check:secrets` proves the repo is clean.

## 12. Known limits (3 min)

- GitHub OAuth requires the provider enabled by the project owner; email auth is
  the demo path.
- Gemini free tier can be slow or return 503; ranking/onboarding fall back to
  rules and label it, the guide shows an offline card.

## 13. When something looks broken (5 min)

| Symptom | Where to look |
|---|---|
| “GitHub sign-in is not enabled” | Supabase → Authentication → Providers → GitHub. The web reads `/auth/v1/settings` and hides the button until `external.github` is true (see `dev/SETUP/02-github-oauth.md`). |
| “The guide is offline…” | The card shows a request id. Run `docker compose logs api | grep <requestId>` or `pnpm dev:api`; the API logs `guide unavailable for user … conversation …` with the provider error. Check `GEMINI_API_KEY` and the model name in `.env`. |
| Guide answers but no cards | `docker compose logs worker`; ranking falls back to rules when Gemini fails and the UI labels it. |
| Drag/drop does nothing | `PATCH /progress/:id` rejects a merged card moving backwards (`ALREADY_MERGED`); the toast shows the API error. |
| Profile edit reverts | Save from the sticky bar; the form hydrates once and no longer overwrites the first click. |
- The guide is non-streaming JSON. FR-11 does not require streaming; the visual
  streamed caret is deferred.
- Email is best-effort; in-app notifications are the record.
- Org contributor search samples the five most recent repositories.
- The demo uses local Postgres (ADR 0006); production switches two env values.

## Where the evidence lives

`dev/STATE.md`, `dev/build-log.md`, `dev/evidence/`, PR bodies, test output and
the manual demo in `docs/DEMO.md`. The product documentation is under `docs/`;
`dev/` is untracked by design.
