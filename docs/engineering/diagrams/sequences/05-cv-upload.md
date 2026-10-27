# Sequence — CV upload and extraction

```mermaid
sequenceDiagram
  autonumber
  actor D as Developer
  participant W as CvUpload
  participant A as CvService
  participant ST as Supabase Storage
  participant Q as Redis/BullMQ
  participant K as Worker
  participant P as unpdf/mammoth
  participant AI as Gemini
  participant DB as Postgres

  D->>W: drop cv.pdf
  W->>A: POST /cv multipart (Bearer)
  A->>A: validate extension, MIME, magic bytes, ≤4 MB
  A->>ST: upload cvs/<userId>/<uuid>.pdf
  A->>DB: CvFile PENDING; remove previous row/object
  A->>Q: enqueue cv.extract key cv:<fileId>
  A-->>W: PENDING
  W->>W: poll GET /cv every 3 s

  K->>Q: consume cv.extract
  K->>DB: status PROCESSING
  K->>ST: download bytes
  K->>P: extract text
  alt AI available
    K->>AI: JSON skills/technologies/level/summary
    AI-->>K: structured result
    K->>DB: AiUsage row
  else AI unavailable
    K->>K: rules extraction, source=RULES
  end
  K->>DB: CvFile COMPLETED + extracted JSON
  W->>A: GET /cv
  A-->>W: COMPLETED + skills
  W-->>D: review chips → Apply to profile
```

Failed extraction stores `FAILED` and a short reason; the UI offers retry and
manual entry. No file is public; no CV text is cached in Redis. See FR-3 and
ADR 0004.
