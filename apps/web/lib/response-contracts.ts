import { z, type ZodTypeAny } from 'zod';
import {
  AccountHistorySchema,
  AccountStatsSchema,
  AchievementsSchema,
  AdminMetricsSchema,
  AdminUsersSchema,
  AiSettingsSchema,
  AiUsageSummarySchema,
  ContributorDetailSchema,
  ContributorSearchResponseSchema,
  CvFileSchema,
  DiscoveryResponseSchema,
  GuideConversationSchema,
  GuideReplySchema,
  IssueContextSchema,
  IssueDetailsSchema,
  IssueOnboardingSchema,
  LearningResourceSchema,
  LearningSearchResponseSchema,
  MeSchema,
  NotificationListSchema,
  NotificationPreferencesSchema,
  NotificationSchema,
  OkSchema,
  OutreachConversationSchema,
  OutreachListSchema,
  OutreachRequestSchema,
  ProfileSchema,
  ProgressHistorySchema,
  ProgressSummarySchema,
  PublicProfileSettingsSchema,
  RecommendationResponseSchema,
  RepositoryOnboardingSchema,
  SavedItemSchema,
  SavedListDetailSchema,
  SavedListSchema,
  SelectionSchema,
} from '@osh/contracts';

export const CvEnvelopeSchema = z.object({ file: CvFileSchema.nullable() });
export const CvUploadEnvelopeSchema = z.object({ file: CvFileSchema });
export const DeletionEnvelopeSchema = z.object({
  requested: z.literal(true),
  requestedAt: z.string(),
});
export const CompleteCheckSchema = z.object({ complete: z.literal(true), profile: ProfileSchema });
export const ReadAllSchema = z.object({ updated: z.number().int().nonnegative() });
export const SyncAcceptedSchema = z.object({ ok: z.literal(true) });
export const SettingsUsageSchema = z.object({
  settings: AiSettingsSchema,
  usage: AiUsageSummarySchema,
});
export const GithubStatusSchema = z.object({
  connected: z.boolean(),
  login: z.string().nullable(),
  connectedAt: z.string().nullable(),
});

/**
 * Parses a known response before a component consumes it. Unknown routes are
 * returned untouched; every route the UI relies on is covered.
 */
export function schemaFor(path: string, method: string): ZodTypeAny | null {
  const clean = path.split('?')[0] ?? path;
  const verb = method.toUpperCase();
  if (clean === '/me' && verb === 'DELETE') return DeletionEnvelopeSchema;
  if (clean === '/github' && verb === 'DELETE') return OkSchema;
  const exact: Record<string, ZodTypeAny> = {
    '/me': MeSchema,
    '/me/history': AccountHistorySchema,
    '/me/stats': AccountStatsSchema,
    '/profile': ProfileSchema,
    '/profile/complete-check': CompleteCheckSchema,
    '/github/status': GithubStatusSchema,
    '/cv': CvEnvelopeSchema,
    '/notifications': NotificationListSchema,
    '/notifications/preferences': NotificationPreferencesSchema,
    '/notifications/read-all': ReadAllSchema,
    '/discovery/issues': DiscoveryResponseSchema,
    '/discovery/recommendations': RecommendationResponseSchema,
    '/discovery/recommendations/regenerate': RecommendationResponseSchema,
    '/discovery/recommendations/latest': RecommendationResponseSchema,
    '/discovery/ignore': OkSchema,
    '/selection': SelectionSchema,
    '/selection/active': SelectionSchema.nullable(),
    '/progress': ProgressSummarySchema,
    '/progress/sync': SyncAcceptedSchema,
    '/saved/lists': verb === 'GET' ? z.array(SavedListSchema) : SavedListSchema,
    '/saved/items': SavedItemSchema,
    '/achievements': AchievementsSchema,
    '/achievements/visibility': OkSchema,
    '/public-profile/settings': PublicProfileSettingsSchema,
    '/public-profile/publish': PublicProfileSettingsSchema,
    '/community/contributors': ContributorSearchResponseSchema,
    '/outreach': verb === 'GET' ? OutreachListSchema : OutreachRequestSchema,
    '/learning': LearningSearchResponseSchema,
    '/admin/metrics': AdminMetricsSchema,
    '/admin/users': AdminUsersSchema,
    '/admin/ai-settings': AiSettingsSchema,
    '/admin/ai-settings/usage': SettingsUsageSchema,
    '/admin/ai-usage': AiUsageSummarySchema,
  };
  if (exact[clean]) return exact[clean] ?? null;
  if (/^\/cv\/[^/]+\/retry$/.test(clean)) return CvUploadEnvelopeSchema;
  if (/^\/discovery\/issues\/[^/]+\/context$/.test(clean)) return IssueContextSchema;
  if (/^\/discovery\/issues\/[^/]+$/.test(clean)) return IssueDetailsSchema;
  if (/^\/onboarding\/repository\/[^/]+$/.test(clean)) return RepositoryOnboardingSchema;
  if (/^\/onboarding\/issue\/[^/]+$/.test(clean)) return IssueOnboardingSchema;
  if (/^\/guide\/conversations\/[^/]+$/.test(clean)) return GuideConversationSchema;
  if (/^\/guide\/conversations\/[^/]+\/messages$/.test(clean)) return GuideReplySchema;
  if (/^\/progress\/[^/]+\/history$/.test(clean)) return ProgressHistorySchema;
  if (/^\/progress\/[^/]+$/.test(clean)) return SelectionSchema;
  if (/^\/saved\/lists\/[^/]+$/.test(clean)) {
    return verb === 'GET' ? SavedListDetailSchema : verb === 'DELETE' ? OkSchema : SavedListSchema;
  }
  if (/^\/saved\/items\/[^/]+\/select$/.test(clean)) return SelectionSchema;
  if (/^\/saved\/items\/[^/]+$/.test(clean)) {
    return verb === 'DELETE' ? OkSchema : SavedItemSchema;
  }
  if (/^\/community\/contributors\/[^/]+$/.test(clean)) return ContributorDetailSchema;
  if (/^\/outreach\/[^/]+\/conversation$/.test(clean)) return OutreachConversationSchema;
  if (/^\/outreach\/[^/]+\/conversation\/messages$/.test(clean)) return OutreachConversationSchema;
  if (/^\/outreach\/[^/]+$/.test(clean)) return OutreachRequestSchema;
  if (/^\/learning\/[^/]+$/.test(clean)) return LearningResourceSchema;
  if (/^\/notifications\/[^/]+\/read$/.test(clean)) return NotificationSchema;
  return null;
}

export function parseContract(path: string, method: string, payload: unknown): unknown {
  const schema = schemaFor(path, method);
  if (!schema) return payload;
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Response did not match the contract for ${method.toUpperCase()} ${path}`);
  }
  return result.data;
}
