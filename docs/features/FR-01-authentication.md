# FR-01 — Authentication and session

> Story: US-1.1, US-1.2, US-1.3, US-1.4, US-1.5 · Sprint: 1 · Slice: 2 · Status: shipped
> Last updated: 2026-10-27

## 1. What it does (user view)

A person signs up or signs in with email/password or GitHub, resets a password, connects or disconnects GitHub, and signs out. Every later screen is gated by a session and a role.

## 2. Why it exists (FR + acceptance criteria)

FR-1.1–1.11. Acceptance: valid credentials create a session; duplicate email and wrong password show an inline error; a reset link is sent; GitHub connect stores an encrypted token; a Developer cannot open an Admin page.

## 3. Where it lives

`apps/web/components/auth-form.tsx`, `app/(auth routes)`, `app/auth/callback/route.ts`, `middleware.ts`, `apps/api/src/auth/*`, `apps/api/src/modules/profile/profile.controller.ts`, `packages/contracts/src/account.ts`

## 4. How it works

1. The browser calls Supabase Auth directly with the anon key.
2. Supabase sets the session cookie; `middleware.ts` refreshes it and redirects protected routes.
3. The BFF proxy reads the session and attaches `Authorization: Bearer <access token>`.
4. Nest verifies the JWT against Supabase JWKS; `users.role` is loaded from Postgres.
5. The GitHub callback exchanges the code, reads `provider_token` once and posts it to `/github/connect`; the API encrypts it with AES-256-GCM.
6. Every browser-initiated redirect (OAuth, reset, new-account confirm) is built by `lib/public-url.ts`: the browser origin with loopback aliases (`0.0.0.0`, `127.0.0.1`) folded to `localhost`, because Supabase matches `redirectTo` against an exact allow-list and Firefox refuses to open `0.0.0.0` at all.

## 5. Sequence diagram

Canonical sequence: [sign-up and login](../engineering/diagrams/sequences/01-auth.md).
The diagram is the source of truth for this flow and maps to the files above.

## 6. Data

`User` (authId unique, email unique, role, githubLogin, githubTokenEnc, lastSeenAt) and `PublicProfile`. Sessions live in Supabase; the app never stores a password. Indexes: `User.authId`, `User.email`, `User.role`.

## 7. Contract

`GET /me`, `PATCH /me`, `GET /github/status`, `POST /github/connect`, `DELETE /github`. Public sign-up/login/reset are Supabase endpoints, not API routes. Errors: 400 validation, 401 missing/expired token, 403 wrong role, 409 duplicate username.

## 8. External calls, quota and fallback

Supabase Auth (free MAU), GitHub OAuth. No token refresh: a revoked provider token returns `GITHUB_TOKEN_UNREADABLE` and the user reconnects.

## 9. Authorization and failure modes

`JwtAuthGuard` is global; `@Public()` only on health, learning and public profiles. Roles come from the database, never a client claim. Ownership is re-checked in profile services. Linking an existing account by email requires `email_verified === true`.

## 10. Decisions and rejected alternatives

ADR 0001 (Nest + Next), ADR 0002 (Supabase-managed GitHub OAuth). Rejected: storing the GitHub client secret in the API, and issuing our own passwords.

## 11. Tests and evidence

`docs/Sprints/sprint1/02-testing.md` M1.1–M1.8. Integration: missing token 401, Developer on Admin 403, contract parse on `/me`; unit test requires a verified email before linking an existing account. GitHub OAuth and reset email delivery are provider-blocked manual checks.

Evidence lives under `dev/evidence/slice-2/`. The PR body records the
exact commands and result.

## 12. Manual demo

Open `/login`, sign in as `dev@osh.dev`, confirm `/discover`. Open `/admin` in the same session and confirm the denial.

## 13. Known limits and what would break it

Email reset delivery depends on Supabase SMTP; the free project's built-in SMTP is best-effort. GitHub sign-in needs the provider enabled by the project owner.

## 14. Changelog

- 2026-10-27 — implemented and documented in the vertical build.
