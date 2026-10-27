# PM1 — deliverables checklist

Maps every PM1 requirement to a real artifact. A row without a link is not done.

## Part A — Design

| PM1 item | Artifact | Status |
|---|---|---|
| System context (level 0): actors, system, provided/required interfaces | [`engineering/diagrams/00-context.md`](engineering/diagrams/00-context.md) | done |
| Interface high-level and low-level notes, “used by” per operation | same file, “Provided” and “Required” sections | done |
| Container diagram (level 1) with protocols | [`01-containers.md`](engineering/diagrams/01-containers.md) | done |
| Component diagram per service (level 2), provided/required | [`02-components-web.md`](engineering/diagrams/02-components-web.md), [`02-components-api.md`](engineering/diagrams/02-components-api.md), [`02-components-worker.md`](engineering/diagrams/02-components-worker.md) | done |
| Class diagram per service after SOLID (level 3) | [`03-class-api.md`](engineering/diagrams/03-class-api.md), [`03-class-web.md`](engineering/diagrams/03-class-web.md) | done |
| ERD; one data owner per service; relations | [`04-erd.md`](engineering/diagrams/04-erd.md), [`data-model.md`](engineering/data-model.md) | done |
| Non-relational key structure, types, references, sample JSON | [`04-redis-keys.md`](engineering/diagrams/04-redis-keys.md) | done |
| Design → code/Jira traceability | [`05-traceability.md`](engineering/diagrams/05-traceability.md) | done |

## Part B — DevOps

| PM1 item | Artifact | Status |
|---|---|---|
| Multi-stage Dockerfile per service | `apps/api/Dockerfile`, `apps/web/Dockerfile` | done |
| Whole system with one `docker compose up` | `docker-compose.yml` (web, api, worker, redis, postgres, migrate) | done |
| Health check per service | compose `healthcheck` for postgres, redis, api, worker, web | done |
| No secret baked into an image | `.dockerignore` excludes `.env*`; build stage removes local symlinks | done |
| Images pushed to GHCR | `.github/workflows/docker.yml`, `sha` + `latest` on main | done |
| GitHub Actions pipeline with a passing build | `.github/workflows/ci.yml` (lint-typecheck, contracts, tests, integration, docker matrix) | done |
| Cache pnpm | `actions/setup-node` + pnpm cache in both workflows | done |
| Pass-on-main evidence | CI green on PR #2: https://github.com/omar-Mokhtar101/OpenSource-Hel-er/actions/runs/40461265525 · guardrail: https://github.com/omar-Mokhtar101/OpenSource-Hel-er/actions/runs/40461265486 | PR open; GHCR after merge |

## Part C — Project management

| PM1 item | Artifact | Status |
|---|---|---|
| Sprint table + story points + planned/actual velocity + estimation error | [`Sprints/velocity.md`](Sprints/velocity.md) | done |
| Jira board import for every story | [`Sprints/jira-import.csv`](Sprints/jira-import.csv) (62 stories, 219 points) | done |
| Burndown data per finished sprint (guideline + remaining) | `Sprints/velocity.md` §4 | done |
| Actual elapsed time per slice | `dev/build-log.md` entries | done |
| Planning poker note for changed stories | `Sprints/velocity.md` §3 | done |

## Part D — Traceability

| PM1 item | Artifact | Status |
|---|---|---|
| Every diagram element maps to code/config/DB/Jira | [`engineering/diagrams/05-traceability.md`](engineering/diagrams/05-traceability.md) | done |
| GitHub, Docker, Actions, Jira links | repo URL, `docker-compose.yml`, workflows, Jira site (`dev/SETUP/07-jira.md`) | done/pending human |

## Submission checklist

- [ ] Push `main`; wait for `ci` and `docker` jobs; paste the run URL in this file.
- [ ] Confirm both GHCR packages: `web` and `api`.
- [ ] Create the Jira project, import the CSV, capture the board + one burndown.
- [ ] Fill the demo rehearsal dates in `docs/DEMO.md`.
- [ ] Submit every team member separately (course rule).

## Rule

Do not produce a diagram that does not map to code, config, database or Jira.
If an artifact changes, update the row in the same PR.
