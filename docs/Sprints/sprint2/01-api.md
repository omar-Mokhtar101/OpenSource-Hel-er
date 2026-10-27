# Sprint 2 — API Contract and Manual API Tests

> Back to [sprint specification](00-sprint.md) · [testing](02-testing.md) · [review](03-review.md)

Status: **defined and shipped.** The table matches the implementation; run the manual checklist against the demo stack.

Global conventions (base URL, auth header, error shape, pagination) live in [`../../API.md`](../../API.md). Define them once and keep them consistent here.

## 1. Endpoint contract

| ID | Method | Path | Auth | Purpose | Request | Response | Errors |
|---|---|---|---|---|---|---|---|
| A2.1 | GET | `/discovery/issues` | Developer | Search open issues | language, label, activityDays, org, repo, page | DiscoveryResponse | 400, 429 GitHub |
| A2.2 | POST | `/discovery/recommendations` | Developer | Three ranked issues | RecommendationRequest | RecommendationResponse | 409 profile/pool, 429 AI |
| A2.3 | POST | `/discovery/recommendations/regenerate` | Developer | Different three | RecommendationRequest | RecommendationResponse | 409 no previous set |
| A2.4 | GET | `/discovery/issues/:id` | Developer | Issue details | encoded `owner/repo#n` | IssueDetails | 404 |
| A2.11 | GET | `/discovery/issues/:id/context` | Developer | Deterministic issue + repository context (README, contributing, files, commands) | encoded `owner/repo#n` | IssueContext | 404, 503 GitHub |
| A2.5 | POST | `/selection` | Developer | Confirm selection | `{issueId, confirmed:true}` | Selection | 400, 409 closed/already/active |
| A2.6 | POST | `/discovery/ignore` | Developer | Ignore an issue | `{issueId}` | `{ok:true}` | 404, 409 selected |
| A2.7 | GET/POST/PATCH/DELETE | `/saved/lists[/:id]` | Developer | Lists CRUD | `{name}` | SavedList / detail | 403, 404, 409 |
| A2.8 | POST/PATCH/DELETE | `/saved/items[/:id]` | Developer | Add/move/remove | `{issueId\|repoFullName, listId}` | SavedItem | 403, 404 |
| A2.9 | POST | `/saved/items/:id/select` | Developer | Select from Saved | — | Selection | 403, 404, 409 |
| A2.10 | GET | `/selection/active` | Developer | Active issue | — | Selection or null | 401 |

## 2. Manual API test checklist

For each endpoint, test the happy path plus the security and validation cases below. Use a Developer, a Maintainer and an Admin account.

| ID | Endpoint | Checks | Expected | Pass |
|---|---|---|---|---|
| A2.1 | Search open GitHub issues using profile and filters | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.2 | Get three recommendations | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.3 | Regenerate recommendations | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.4 | Get issue details | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.11 | Get deterministic issue context | Happy path; missing session → 401; invalid id → 404; GitHub down → 503 | README, labels, comments and commands match the repository; no AI call | ☐ |
| A2.5 | Select and confirm an issue | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.6 | Ignore an issue | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.7 | List, create, rename and delete saved lists | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.8 | Add, move and remove saved items | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |
| A2.9 | Select an issue from saved items | Happy path; missing session → 401; wrong role/owner → 403/404; invalid input → 4xx | Response follows contract; side effect correct | ☐ |

## 3. How to run the manual checks

1. Set `BASE_URL` to the local or deployed environment.
2. Obtain a session/token for each role and store them as `DEV_TOKEN`, `MNT_TOKEN`, `ADMIN_TOKEN`.
3. Call each endpoint with curl or Postman:

```bash
curl -i -X <METHOD> "$BASE_URL<PATH>" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '<REQUEST_BODY>'
```

4. Record status code, response body and the database/storage side effect.
5. Test missing session (`401`), wrong role or owner (`403`/`404`), invalid input (`400`) and not found (`404`).
6. Tick `Pass` only when the contract table and the real response agree. Update the contract first when they differ.

## 4. Exit criteria

- Every endpoint has a method, path, auth rule, request, response and error list.
- Every manual check above passed on the sprint build.
- No endpoint returns another user's private data.
- The table matches the implementation; no undocumented endpoint exists.
