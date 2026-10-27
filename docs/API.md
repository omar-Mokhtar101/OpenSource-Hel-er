# API Contract

Status: **conventions shipped; endpoints are defined per sprint.**

Global conventions live here. Each sprint owns its endpoint table and manual
checklist in `Sprints/sprintN/01-api.md`.

## Conventions

| Topic | Decision |
|---|---|
| Base URL | Direct: `http://localhost:4000`. Browser: same-origin `/api/*`, proxied by `apps/web/app/api/[...path]/route.ts`. |
| Versioning | No path version for the course build; contracts are versioned in `packages/contracts` and breaking changes require a new schema + migration note. |
| Authentication | Supabase access token in `Authorization: Bearer <jwt>`. Verified via JWKS (ES256). `AUTH_DEV_MODE` accepts `dev:<seeded-email>` only outside production. |
| Authorization | Roles `DEVELOPER`, `MAINTAINER`, `ADMIN`. Global guard + `@Roles` + service-level ownership. |
| Request format | JSON (`application/json`) except CV `multipart/form-data` with field `file`. |
| Response format | JSON validated by Zod. Lists include `page`/`perPage`; notifications include `total`. |
| Error format | `{ statusCode, code, message, requestId?, details? }`. `code` is stable (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `LIMIT_REACHED`, `AI_UNAVAILABLE`, …). |
| Pagination | `page` (1-based) and `perPage` (max 100) for notifications; discovery uses GitHub page/per_page internally. |
| Rate limits | 180 requests/min/IP default; AI is capped per user/month and platform USD; outreach is 5/day; auth is Supabase-managed. |
| Date/time | ISO 8601 UTC strings. |
| File uploads | PDF or DOCX, ≤4 MB, magic-byte checked, private `cvs` bucket, signed/owner-only download. |
| Request ID | `x-request-id` echoed; logs contain userId/requestId, never tokens. |
| CORS | None. The browser only calls the web origin. |
| Health | `GET /health` liveness; `GET /health/ready` database readiness and a Redis check in the body. |

## Sprint contracts

| Sprint | Resources | Contract and manual checks |
|---|---|---|
| 1 | Auth, account/profile, developer profile, CV, AI settings, notifications | [01-api.md](Sprints/sprint1/01-api.md) |
| 2 | Issue search/filters, deterministic issue context, recommendations, regenerate, selection/ignore, saved lists | [01-api.md](Sprints/sprint2/01-api.md) |
| 3 | Repository/issue onboarding, AI guide chat, progress | [01-api.md](Sprints/sprint3/01-api.md) |
| 4 | Progress history, notifications/preferences, badges/streaks, account history/delete, admin metrics | [01-api.md](Sprints/sprint4/01-api.md) |
| 5 | Public profiles, contributor search, outreach/conversations, learning resources, AI usage | [01-api.md](Sprints/sprint5/01-api.md) |

## Rules

- Add the endpoint to the sprint contract before writing the handler or client call.
- Every endpoint lists its required role and error responses.
- Test the happy path plus `401`, `403`/`404` and `400` for each endpoint.
- Keep this file limited to conventions and links; put endpoint details in the sprint file.
