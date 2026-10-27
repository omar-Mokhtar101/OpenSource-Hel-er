import { z } from 'zod';
import {
  ExperienceLevelSchema,
  PaginationQuerySchema,
  ProgressStatusSchema,
  idSchema,
  isoDate,
} from './common.js';

/* -------------------------------------------------------------------------- */
/* Issue discovery (FR-4)                                                      */
/* -------------------------------------------------------------------------- */

export const ActivityWindowSchema = z.union([z.literal(30), z.literal(90), z.literal(180)]);
export type ActivityWindow = z.infer<typeof ActivityWindowSchema>;

export const DiscoveryFiltersSchema = z.object({
  language: z.string().trim().max(40).optional(),
  label: z.string().trim().max(60).optional(),
  activityDays: z.coerce.number().int().min(1).max(365).optional(),
  org: z.string().trim().max(80).optional(),
  repo: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Use owner/name')
    .max(140)
    .optional(),
});
export type DiscoveryFilters = z.infer<typeof DiscoveryFiltersSchema>;

export const DiscoveryQuerySchema = DiscoveryFiltersSchema.merge(PaginationQuerySchema);
export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;

export const IssueCandidateSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  repoFullName: z.string(),
  organization: z.string().nullable(),
  title: z.string(),
  url: z.string().url(),
  labels: z.array(z.string()),
  language: z.string().nullable(),
  level: ExperienceLevelSchema.nullable(),
  repoDescription: z.string().nullable(),
  stars: z.number().int().nonnegative(),
  updatedAt: isoDate,
  activityDays: z.number().int().nonnegative(),
  assigned: z.boolean(),
  state: z.string(),
});
export type IssueCandidate = z.infer<typeof IssueCandidateSchema>;

export const DiscoveryResponseSchema = z.object({
  items: z.array(IssueCandidateSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  perPage: z.number().int(),
  cached: z.boolean(),
  stale: z.boolean(),
  fetchedAt: isoDate,
  rateLimitedUntil: isoDate.nullable(),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

export const IssueDetailsSchema = z.object({
  issue: IssueCandidateSchema,
  body: z.string(),
  comments: z.array(z.object({ author: z.string(), body: z.string(), createdAt: isoDate })),
  requirements: z.object({
    technologies: z.array(z.string()),
    knowledge: z.array(z.string()),
    level: ExperienceLevelSchema.nullable(),
    prerequisites: z.array(z.string()),
  }),
  repo: z.object({
    fullName: z.string(),
    description: z.string().nullable(),
    url: z.string().url(),
    stars: z.number().int().nonnegative(),
    defaultBranch: z.string(),
    language: z.string().nullable(),
  }),
  reason: z.string().nullable(),
  saved: z.boolean(),
  ignored: z.boolean(),
  selected: z.boolean(),
});
export type IssueDetails = z.infer<typeof IssueDetailsSchema>;

/* -------------------------------------------------------------------------- */
/* Deterministic issue + repository context (no AI)                            */
/* -------------------------------------------------------------------------- */

export const IssueContextSchema = z.object({
  issue: z.object({
    id: z.string(),
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string(),
    url: z.string().url(),
    state: z.string(),
    labels: z.array(z.string()),
    author: z.string().nullable(),
    assignee: z.string().nullable(),
    createdAt: isoDate.nullable(),
    updatedAt: isoDate.nullable(),
  }),
  comments: z.array(
    z.object({
      author: z.string(),
      body: z.string(),
      createdAt: isoDate,
      url: z.string().url().nullable(),
    }),
  ),
  repo: z.object({
    fullName: z.string(),
    url: z.string().url(),
    description: z.string().nullable(),
    defaultBranch: z.string(),
    stars: z.number().int().nonnegative(),
    forks: z.number().int().nonnegative(),
    openIssues: z.number().int().nonnegative(),
    topics: z.array(z.string()),
    language: z.string().nullable(),
    languages: z.array(z.object({ name: z.string(), percent: z.number().nonnegative() })),
    license: z.string().nullable(),
    homepage: z.string().nullable(),
    cloneUrl: z.string().url(),
    sshUrl: z.string(),
    pushedAt: isoDate.nullable(),
    readmeUrl: z.string().url(),
    contributingUrl: z.string().url().nullable(),
  }),
  readme: z.string(),
  contributing: z.string(),
  files: z.array(z.string()),
  commands: z
    .array(z.object({ label: z.string().min(1), command: z.string().min(1) }))
    .min(1),
  links: z.object({
    repo: z.string().url(),
    issue: z.string().url(),
    readme: z.string().url(),
    contributing: z.string().url().nullable(),
  }),
});
export type IssueContext = z.infer<typeof IssueContextSchema>;

/* -------------------------------------------------------------------------- */
/* Issue matching (FR-5)                                                       */
/* -------------------------------------------------------------------------- */

export const RecommendationRequestSchema = DiscoveryFiltersSchema.extend({
  refresh: z.boolean().optional(),
}).strict();
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;

export const RecommendationSchema = z.object({
  issue: IssueCandidateSchema,
  rank: z.number().int().min(1).max(3),
  reason: z.string().max(400),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const RecommendationResponseSchema = z.object({
  batchId: idSchema,
  recommendations: z.array(RecommendationSchema).length(3),
  fallback: z.boolean(),
  fallbackReason: z.string().nullable(),
  generatedAt: isoDate,
  remainingTokens: z.number().int().nonnegative(),
});
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Issue selection (FR-6) and progress (FR-8)                                  */
/* -------------------------------------------------------------------------- */

export const SelectIssueSchema = z
  .object({
    issueId: z.string().min(3).max(200),
    confirmed: z.literal(true),
  })
  .strict();
export type SelectIssue = z.infer<typeof SelectIssueSchema>;

export const IgnoreIssueSchema = z
  .object({
    issueId: z.string().min(3).max(200),
  })
  .strict();
export type IgnoreIssue = z.infer<typeof IgnoreIssueSchema>;

export const SelectionSchema = z.object({
  id: idSchema,
  issue: IssueCandidateSchema,
  status: ProgressStatusSchema,
  prUrl: z.string().url().nullable(),
  selectedAt: isoDate,
  updatedAt: isoDate,
  daysSinceSelected: z.number().int().nonnegative(),
  lastSyncedAt: isoDate.nullable(),
});
export type Selection = z.infer<typeof SelectionSchema>;

export const ProgressSummarySchema = z.object({
  counts: z.object({
    inProgress: z.number().int().nonnegative(),
    prOpen: z.number().int().nonnegative(),
    merged: z.number().int().nonnegative(),
    ignored: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
  }),
  items: z.array(SelectionSchema),
  lastSyncedAt: isoDate.nullable(),
});
export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;

export const UpdateProgressSchema = z
  .object({
    status: ProgressStatusSchema.optional(),
    prUrl: z
      .string()
      .url()
      .regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/, 'Use a GitHub pull request URL')
      .nullable()
      .optional(),
    note: z.string().trim().max(280).nullable().optional(),
  })
  .strict();
export type UpdateProgress = z.infer<typeof UpdateProgressSchema>;

export const ProgressEventSchema = z.object({
  id: idSchema,
  status: ProgressStatusSchema,
  source: z.enum(['MANUAL', 'SYNC']),
  prUrl: z.string().url().nullable(),
  note: z.string().nullable(),
  createdAt: isoDate,
});
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;

export const ProgressHistorySchema = z.object({
  selection: SelectionSchema,
  events: z.array(ProgressEventSchema),
});
export type ProgressHistory = z.infer<typeof ProgressHistorySchema>;

/* -------------------------------------------------------------------------- */
/* Saved items (FR-7)                                                          */
/* -------------------------------------------------------------------------- */

export const SavedListSchema = z.object({
  id: idSchema,
  name: z.string(),
  itemCount: z.number().int().nonnegative(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type SavedList = z.infer<typeof SavedListSchema>;

export const CreateSavedListSchema = z
  .object({ name: z.string().trim().min(1).max(60) })
  .strict();
export type CreateSavedList = z.infer<typeof CreateSavedListSchema>;

export const UpdateSavedListSchema = z
  .object({ name: z.string().trim().min(1).max(60) })
  .strict();
export type UpdateSavedList = z.infer<typeof UpdateSavedListSchema>;

export const SavedItemSchema = z.object({
  id: idSchema,
  listId: idSchema,
  issue: IssueCandidateSchema.nullable(),
  repoFullName: z.string().nullable(),
  repoUrl: z.string().url().nullable(),
  issueState: z.enum(['OPEN', 'CLOSED', 'TAKEN', 'UNKNOWN']),
  createdAt: isoDate,
});
export type SavedItem = z.infer<typeof SavedItemSchema>;

export const SavedListDetailSchema = SavedListSchema.extend({
  items: z.array(SavedItemSchema),
});
export type SavedListDetail = z.infer<typeof SavedListDetailSchema>;

export const SaveItemSchema = z
  .object({
    listId: z.string().optional(),
    issueId: z.string().optional(),
    repoFullName: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/)
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.issueId) !== Boolean(value.repoFullName), {
    message: 'Provide either issueId or repoFullName',
  });
export type SaveItem = z.infer<typeof SaveItemSchema>;

export const MoveItemSchema = z.object({ listId: z.string().min(1) }).strict();
export type MoveItem = z.infer<typeof MoveItemSchema>;
