# FR-10 — Issue onboarding

> Story: US-10.1, US-10.2, US-10.3 · Sprint: 3 · Slice: 4 · Status: shipped
> Last updated: 2026-10-27

## 1. What it does (user view)

A plain-language summary of the issue and discussion, the technologies/knowledge/level required, related files and documentation links. No complete solution or implementation code.

## 2. Why it exists (FR + acceptance criteria)

FR-10.1–10.9. Acceptance: summary, requirements, related code and resources; onboarding content contains no solution.

## 3. Where it lives

`apps/api/src/modules/onboarding/onboarding.service.ts`, `apps/api/src/modules/ai/prompts.ts`, `components/issue-detail.tsx`, `components/prose.tsx`

The deterministic half of the page is `GET /discovery/issues/:id/context`
(`modules/discovery/start-commands.ts`, `modules/github/github.service.ts`):
full issue text, comments, README, CONTRIBUTING, file tree, clone/branch/test
commands and repository links, with no AI call.

## 4. How it works

1. The call verifies the issue is selected by the caller.
2. It fetches issue comments and repo context, then reuses `IssueOnboarding` when the issue's `updated_at` did not change.
3. Gemini returns structured JSON; every string is sanitized by the guardrail.
4. A rules fallback builds a summary from the issue body, labels and tree.
5. The UI renders prose (headings, lists, inline paths) without a code-block renderer.

## 5. Sequence diagram

Canonical sequence: [issue onboarding](../engineering/diagrams/sequences/03-selection-onboarding.md).
The diagram is the source of truth for this flow and maps to the files above.

## 6. Data

`IssueOnboarding` unique `issueId`, sourceUpdatedAt, requirements JSON, relatedFiles JSON, resources JSON.

## 7. Contract

`GET /onboarding/issue/:issueId` (Developer, owner). Errors: 404 not selected, 503 AI/GitHub fallback.

## 8. External calls, quota and fallback

GitHub issue/comments/repo, Gemini `ONBOARDING`.

## 9. Authorization and failure modes

Selection ownership; onboarding is generated per issue and cached, but only returned to owners.

## 10. Decisions and rejected alternatives

Structured sections instead of one long answer, so the UI can show provenance and the guardrail can inspect each field.

## 11. Tests and evidence

Live run produced a summary with evidence and 3 resources; the guardrail strips any code before storage.

Evidence lives under `dev/evidence/slice-4/`. The PR body records the
exact commands and result.

## 12. Manual demo

Issue → Overview → Summary, What you'll need, Where to start, Resources.

## 13. Known limits and what would break it

Long discussions are truncated. The model may add Markdown headings; the UI renders them as prose, not raw markers.

## 14. Changelog

- 2026-10-27 — implemented and documented in the vertical build.
