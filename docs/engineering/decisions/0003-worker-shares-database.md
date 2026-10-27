---
status: accepted
---

# 0003 — The worker shares the API's database

## Context

The worker handles CV extraction, GitHub sync, notifications, badges, admin
aggregates and account deletion. A strict reading of "each service owns its
data" could put the worker on a second database or behind an API.

## Decision

The API and worker are **two processes of the same service**. They share one
Postgres schema and one Prisma client. Each has its own image
(`apps/api/Dockerfile`, `apps/worker/Dockerfile`) built from the same source
tree; only the entrypoint differs. The API enqueues jobs; the worker consumes
them and writes the resulting rows. No service reads another service's database.

The health model reflects this: the worker checks the API readiness endpoint and
the shared database, not a second store.

## Alternatives rejected

| Option | Why not |
|---|---|
| Worker calls the API over HTTP | Adds latency, a second auth path and a circular dependency for jobs the API just enqueued |
| Separate worker database | Two writers for the same user/issue state, and no cross-database transaction |
| Do work inline in the request | Violates rule 4 and the 2s budget |

## Consequences

- One migration history and one backup.
- A schema change is reviewed once for both processes.
- Job payloads carry ids, never file bytes or tokens.
- Scaling the worker is independent of the API, but the database is the shared
  bottleneck; the scale path documents read replicas before extraction.

## Revisit

If the worker becomes a separate bounded context with different data retention,
split it then. The module boundary in `apps/api/src/jobs` already separates it.
