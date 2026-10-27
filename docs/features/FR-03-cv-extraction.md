# FR-03 — CV extraction

> Story: US-3.1, US-3.2, US-3.3 · Sprint: 1 · Slice: 2 · Status: shipped
> Last updated: 2026-10-27

## 1. What it does (user view)

A developer uploads a PDF or DOCX (≤4 MB), sees processing status, then reviews extracted skills, technologies and level and applies them to the profile.

## 2. Why it exists (FR + acceptance criteria)

FR-3.1–3.11. Acceptance: unsupported type/size is rejected; text is extracted; status reaches completed; corrections persist; a new upload replaces the previous extraction.

## 3. Where it lives

`components/cv-upload.tsx`, `apps/api/src/modules/cv/*`, `apps/api/src/infra/storage.service.ts`, `apps/api/src/jobs/worker-runner.ts`, `packages/contracts/src/account.ts`

## 4. How it works

1. The web posts multipart to the BFF; the API validates extension, MIME and magic bytes.
2. The file is stored in the private `cvs` Supabase bucket and a `CvFile` row is created.
3. The API enqueues `cv.extract` with key `cv:<fileId>`.
4. The worker downloads the file, extracts text (`unpdf`/`mammoth`), calls Gemini with a JSON schema, and falls back to rules if AI is unavailable.
5. The row becomes COMPLETED/FAILED; the UI polls `GET /cv` and offers Apply to profile.

## 5. Sequence diagram

Canonical sequence: [CV upload and extraction](../engineering/diagrams/sequences/05-cv-upload.md).
The diagram is the source of truth for this flow and maps to the files above.

## 6. Data

`CvFile` (storagePath, mime, size, status, extracted JSON, rawText, error). Owner-scoped; previous rows and objects are removed after a successful new upload.

## 7. Contract

`POST /cv` multipart `file`, `GET /cv`, `POST /cv/:id/retry`. Errors: 400 type/empty, 413 size, 503 queue/storage, 404 not owner.

## 8. External calls, quota and fallback

Supabase Storage (private bucket), Gemini `CV_EXTRACTION`, local PDF parser. Queue retries 3 with exponential backoff. AI usage is metered before the provider call.

## 9. Authorization and failure modes

`CvService` uses `userId` from the token and filters every query by it. Storage paths start with the user id.

## 10. Decisions and rejected alternatives

ADR 0004: in-process parsing (`unpdf` + Gemini structured extraction), not a third-party CV service. Rejected: a paid parser and sending raw files to a browser-side model.

## 11. Tests and evidence

Guardrail unit tests; the live pipeline was run with `apps/api/test-fixtures/cv.pdf` → COMPLETED in ~3 s with 7 skills. The file-size guard is unit-tested; the status transition is enforced by the service and observed in the live run.

Evidence lives under `dev/evidence/slice-2/`. The PR body records the
exact commands and result.

## 12. Manual demo

Settings → Profile → drop `cv.pdf`; watch the status; press Apply to profile; save and reload.

## 13. Known limits and what would break it

Scanned PDFs without a text layer cannot be read; the UI says so. DOCX is supported; images are not. Gemini free-tier 503 falls back to rules and labels the source.

## 14. Changelog

- 2026-10-27 — implemented and documented in the vertical build.
