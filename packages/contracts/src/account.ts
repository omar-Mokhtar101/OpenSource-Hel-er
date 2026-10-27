import { z } from 'zod';
import {
  AiFeatureSchema,
  ExperienceLevelSchema,
  NotificationChannelSchema,
  NotificationFrequencySchema,
  NotificationTypeSchema,
  RoleSchema,
  idSchema,
  isoDate,
} from './common.js';

/* -------------------------------------------------------------------------- */
/* Account and authentication (FR-1, FR-14)                                    */
/* -------------------------------------------------------------------------- */

export const GithubConnectionSchema = z.object({
  connected: z.boolean(),
  login: z.string().nullable(),
  connectedAt: isoDate.nullable(),
});
export type GithubConnection = z.infer<typeof GithubConnectionSchema>;

export const MeSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  name: z.string(),
  username: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: RoleSchema,
  github: GithubConnectionSchema,
  createdAt: isoDate,
  lastSeenAt: isoDate.nullable(),
});
export type Me = z.infer<typeof MeSchema>;

export const UpdateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Lowercase letters, numbers and hyphens only')
      .optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
  })
  .strict();
export type UpdateMe = z.infer<typeof UpdateMeSchema>;

export const ConnectGithubSchema = z
  .object({
    providerToken: z.string().min(10),
    login: z.string().min(1).max(80).optional(),
  })
  .strict();
export type ConnectGithub = z.infer<typeof ConnectGithubSchema>;

export const GithubStatusSchema = GithubConnectionSchema;
export type GithubStatus = z.infer<typeof GithubStatusSchema>;

/* -------------------------------------------------------------------------- */
/* Developer profile (FR-2)                                                    */
/* -------------------------------------------------------------------------- */

export const ProfileSchema = z.object({
  description: z.string().nullable(),
  experienceLevel: ExperienceLevelSchema.nullable(),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  completeness: z.number().int().min(0).max(100),
  complete: z.boolean(),
  updatedAt: isoDate.nullable(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = z
  .object({
    description: z.string().trim().max(280).nullable().optional(),
    experienceLevel: ExperienceLevelSchema.nullable().optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    languages: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  })
  .strict();
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const MAX_SKILLS = 12;
export const MAX_LANGUAGES = 8;

/* -------------------------------------------------------------------------- */
/* CV extraction (FR-3)                                                        */
/* -------------------------------------------------------------------------- */

export const CvStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
export type CvStatus = z.infer<typeof CvStatusSchema>;

export const CvExtractionSchema = z.object({
  skills: z.array(z.string()).max(30),
  technologies: z.array(z.string()).max(30),
  experienceLevel: ExperienceLevelSchema.nullable(),
  summary: z.string().max(600).nullable(),
  source: z.enum(['AI', 'RULES']),
});
export type CvExtraction = z.infer<typeof CvExtractionSchema>;

export const CvFileSchema = z.object({
  id: idSchema,
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  status: CvStatusSchema,
  extraction: CvExtractionSchema.nullable(),
  error: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type CvFile = z.infer<typeof CvFileSchema>;

export const CV_ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
// Vercel Functions reject request bodies larger than 4.5 MB, and the browser
// upload goes through the Next BFF (a function) before it reaches the API. A
// 4 MB cap keeps multipart overhead inside that limit; a larger file would fail
// at the platform with an opaque 413 before our validation ever runs.
export const CV_MAX_BYTES = 4 * 1024 * 1024;
export const CV_ALLOWED_EXTENSIONS = ['pdf', 'docx'] as const;

/* -------------------------------------------------------------------------- */
/* AI settings and usage (FR-20, FR-19.5)                                      */
/* -------------------------------------------------------------------------- */

export const AiSettingsSchema = z.object({
  maxTokensPerUser: z.number().int().min(1000).max(2_000_000),
  temperature: z.number().min(0).max(1),
  usageLimitUsd: z.number().min(0).max(10_000),
  updatedAt: isoDate,
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const UpdateAiSettingsSchema = z
  .object({
    maxTokensPerUser: z.number().int().min(1000).max(2_000_000).optional(),
    temperature: z.number().min(0).max(1).optional(),
    usageLimitUsd: z.number().min(0).max(10_000).optional(),
  })
  .strict();
export type UpdateAiSettings = z.infer<typeof UpdateAiSettingsSchema>;

export const AiUsageByFeatureSchema = z.object({
  feature: AiFeatureSchema,
  requests: z.number().int().nonnegative(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type AiUsageByFeature = z.infer<typeof AiUsageByFeatureSchema>;

export const AiUsageSummarySchema = z.object({
  periodStart: isoDate,
  periodEnd: isoDate,
  requests: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  maxTokensPerUser: z.number().int(),
  usageLimitUsd: z.number(),
  percentOfLimit: z.number().min(0),
  byFeature: z.array(AiUsageByFeatureSchema),
  capturedAt: isoDate,
});
export type AiUsageSummary = z.infer<typeof AiUsageSummarySchema>;

/* -------------------------------------------------------------------------- */
/* Notifications (FR-13)                                                       */
/* -------------------------------------------------------------------------- */

export const NotificationSchema = z.object({
  id: idSchema,
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  read: z.boolean(),
  createdAt: isoDate,
});
export type NotificationDto = z.infer<typeof NotificationSchema>;

export const NotificationListSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative(),
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int().nonnegative(),
});
export type NotificationList = z.infer<typeof NotificationListSchema>;

export const NotificationPreferencesSchema = z.object({
  channels: z.array(NotificationChannelSchema).min(1),
  frequency: NotificationFrequencySchema,
  eventTypes: z.record(NotificationTypeSchema, z.boolean()),
  updatedAt: isoDate.nullable(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesSchema = z
  .object({
    channels: z.array(NotificationChannelSchema).min(1).max(2).optional(),
    frequency: NotificationFrequencySchema.optional(),
    eventTypes: z.record(NotificationTypeSchema, z.boolean()).optional(),
  })
  .strict();
export type UpdateNotificationPreferences = z.infer<typeof UpdateNotificationPreferencesSchema>;
