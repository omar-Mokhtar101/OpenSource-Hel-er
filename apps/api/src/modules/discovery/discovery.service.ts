import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  IssueCandidate,
  IssueDetails,
  Recommendation,
  RecommendationRequest,
  RecommendationResponse,
} from '@osh/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../common/errors';
import { ProfileService } from '../profile/profile.service';
import { GithubService } from '../github/github.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { GeminiService } from '../ai/gemini.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AI_FEATURE, RANKING_SYSTEM, rankingPrompt } from '../ai/prompts';
import { parseJsonObject } from '../ai/json';
import { isAiLimitError } from '../ai/limits';

const RankingSchema = z.object({
  ranking: z
    .array(
      z.object({
        issueId: z.string(),
        rank: z.number().int(),
        reason: z.string().min(1).max(400),
      }),
    )
    .min(1)
    .max(10),
});

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profile: ProfileService,
    private readonly github: GithubService,
    private readonly aiUsage: AiUsageService,
    private readonly gemini: GeminiService,
    private readonly notifications: NotificationsService,
  ) {}

  async search(
    userId: string,
    filters: {
      language?: string;
      label?: string;
      activityDays?: number;
      org?: string;
      repo?: string;
    },
    page = 1,
    perPage = 20,
  ) {
    return this.github.searchIssues(userId, filters, page, perPage);
  }

  async issue(userId: string, issueId: string): Promise<IssueDetails> {
    return this.github.issueDetails(userId, issueId);
  }

  async recommend(
    userId: string,
    input: RecommendationRequest,
    regenerate: boolean,
  ): Promise<RecommendationResponse> {
    const profile = await this.profile.requireComplete(userId);
    const previous = regenerate
      ? await this.prisma.recommendation.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { issueId: true, batchId: true },
        })
      : [];
    const excludeIds = new Set(previous.map((row) => row.issueId));
    if (regenerate && excludeIds.size === 0) {
      throw new AppError(
        'NO_PREVIOUS_SET',
        'Find issues first, then regenerate that set.',
        409,
      );
    }

    const search = await this.github.searchIssues(
      userId,
      {
        language: input.language,
        label: input.label,
        activityDays: input.activityDays,
        org: input.org,
        repo: input.repo,
      },
      1,
      30,
    );
    const pool = search.items.filter((item) => !excludeIds.has(item.id)).slice(0, 20);
    if (pool.length < 3) {
      throw new AppError(
        'NOT_ENOUGH_CANDIDATES',
        'We found fewer than three suitable issues. Widen the activity window or drop the label filter.',
        409,
      );
    }

    const batchId = randomUUID();
    let selected: Array<{ issue: IssueCandidate; reason: string }> = [];
    let fallback = false;
    let fallbackReason: string | null = null;
    let usageTokens = 0;
    let usedTokens = 0;
    let maxTokens = 0;

    try {
      const allowance = await this.aiUsage.assertAllowed(userId, AI_FEATURE.matching);
      usedTokens = allowance.usedTokens;
      maxTokens = allowance.settings.maxTokensPerUser;
      const profileText = [
        `Level: ${profile.experienceLevel}`,
        `Languages: ${profile.languages.join(', ')}`,
        `Skills: ${profile.skills.join(', ')}`,
        `About: ${profile.description ?? 'not provided'}`,
      ].join('\n');
      const candidates = pool.map((item) => ({
        issueId: item.id,
        title: item.title,
        repo: item.repoFullName,
        labels: item.labels,
        language: item.language,
        level: item.level,
        stars: item.stars,
        activeDaysAgo: item.activityDays,
        repoDescription: item.repoDescription?.slice(0, 180),
      }));
      const result = await this.gemini.generateJson({
        system: RANKING_SYSTEM,
        prompt: rankingPrompt(profileText, JSON.stringify(candidates)),
        temperature: allowance.settings.temperature,
        maxOutputTokens: 2000,
        timeoutMs: 8_000,
        model: 'gemini-2.5-flash-lite',
        schema: {
          type: 'OBJECT',
          properties: {
            ranking: {
              type: 'ARRAY',
              maxItems: 3,
              items: {
                type: 'OBJECT',
                properties: {
                  issueId: { type: 'STRING' },
                  rank: { type: 'INTEGER' },
                  reason: { type: 'STRING' },
                },
                required: ['issueId', 'rank', 'reason'],
              },
            },
          },
          required: ['ranking'],
        },
      });
      usageTokens = result.promptTokens + result.completionTokens;
      await this.aiUsage.record({
        userId,
        feature: AI_FEATURE.matching,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        requestId: batchId,
      });
      const parsed = RankingSchema.parse(parseJsonObject(result.text));
      const byId = new Map(pool.map((item) => [item.id, item]));
      const picked: Array<{ issue: IssueCandidate; reason: string }> = [];
      const seen = new Set<string>();
      for (const row of parsed.ranking.sort((a, b) => a.rank - b.rank)) {
        const issue = byId.get(row.issueId);
        if (!issue || seen.has(issue.id)) continue;
        seen.add(issue.id);
        picked.push({ issue, reason: row.reason.trim().slice(0, 180) });
        if (picked.length === 3) break;
      }
      if (picked.length !== 3) throw new Error('AI did not return three usable ids');
      selected = picked;
    } catch (error) {
      if (isAiLimitError(error)) throw error;
      if (error instanceof AppError && error.code.startsWith('AI_')) {
        this.logger.warn(`ranking fallback: ${error.code}`);
        fallbackReason = 'The AI is unavailable. These issues were ranked by matching rules.';
      } else {
        this.logger.warn(`ranking fallback: ${error instanceof Error ? error.message : 'unknown'}`);
        fallbackReason = 'The AI returned an unusable ranking. These issues were ranked by matching rules.';
      }
      fallback = true;
      selected = heuristicRank(pool, profile, input.language).slice(0, 3).map((issue) => ({
        issue,
        reason: ruleReason(issue, profile, input.language),
      }));
    }

    if (selected.length < 3) {
      throw new AppError(
        'NOT_ENOUGH_CANDIDATES',
        'We could not build three distinct recommendations. Widen your filters and try again.',
        409,
      );
    }

    const recommendations: Recommendation[] = selected.map((entry, index) => ({
      issue: entry.issue,
      rank: index + 1,
      reason: entry.reason,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.recommendation.createMany({
        data: recommendations.map((recommendation) => ({
          batchId,
          userId,
          issueId: recommendation.issue.id,
          rank: recommendation.rank,
          reason: recommendation.reason,
          fallback,
        })),
      });
      await tx.suggestionEvent.createMany({
        data: recommendations.map((recommendation) => ({
          userId,
          issueId: recommendation.issue.id,
          kind: regenerate ? 'REGENERATED' : 'SUGGESTED',
          batchId,
        })),
      });
    });

    await this.notifications
      .create({
        userId,
        type: 'NEW_MATCH',
        title: 'Three issues match your profile',
        body: 'A fresh set is ready on Discover. Each card explains why it fits.',
        link: '/discover',
        dedupeKey: `match:${batchId}`,
      })
      .catch(() => null);

    const totalAfter = usedTokens + usageTokens;
    return {
      batchId,
      recommendations,
      fallback,
      fallbackReason,
      generatedAt: new Date().toISOString(),
      remainingTokens: maxTokens > 0 ? Math.max(0, maxTokens - totalAfter) : 0,
    };
  }

  async latest(userId: string): Promise<RecommendationResponse> {
    const latest = await this.prisma.recommendation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { batchId: true, createdAt: true },
    });
    if (!latest) throw AppError.notFound('No recommendations yet');
    const rows = await this.prisma.recommendation.findMany({
      where: { userId, batchId: latest.batchId },
      include: { issue: true },
      orderBy: { rank: 'asc' },
    });
    const usage = await this.aiUsage.assertAllowed(userId, AI_FEATURE.matching).catch(() => null);
    return {
      batchId: latest.batchId,
      recommendations: rows.map((row) => ({
        issue: mapRow(row.issue),
        rank: row.rank,
        reason: row.reason,
      })),
      fallback: rows.some((row) => row.fallback),
      fallbackReason: rows.some((row) => row.fallback)
        ? 'These issues were ranked by matching rules.'
        : null,
      generatedAt: latest.createdAt.toISOString(),
      remainingTokens: usage ? Math.max(0, usage.settings.maxTokensPerUser - usage.usedTokens) : 0,
    };
  }

  async issueReason(userId: string, issueId: string): Promise<string | null> {
    const row = await this.prisma.recommendation.findFirst({
      where: { userId, issueId },
      orderBy: { createdAt: 'desc' },
      select: { reason: true },
    });
    return row?.reason ?? null;
  }
}

export function heuristicRank(
  pool: IssueCandidate[],
  profile: { languages: string[]; skills: string[]; experienceLevel: string | null },
  requestedLanguage?: string,
): IssueCandidate[] {
  const languages = new Set(
    [requestedLanguage, ...profile.languages]
      .filter((language): language is string => Boolean(language))
      .map((language) => language.toLowerCase()),
  );
  const skills = profile.skills
    .map((skill) => skill.trim().toLowerCase())
    .filter((skill) => skill.length >= 2);
  return [...pool].sort((a, b) => score(b) - score(a));

  function score(issue: IssueCandidate): number {
    let value = 0;
    if (issue.language && languages.has(issue.language.toLowerCase())) value += 50;
    if (profile.experienceLevel && issue.level === profile.experienceLevel) value += 25;
    if (issue.level === 'BEGINNER') value += 10;
    if (issue.labels.some((label) => /good first issue/i.test(label))) value += 20;
    value += Math.max(0, 30 - issue.activityDays);
    value += Math.min(15, Math.floor(issue.stars / 5000));
    const text = [issue.title, issue.repoDescription ?? '', issue.language ?? '', ...issue.labels]
      .join(' ')
      .toLowerCase();
    const matchedSkills = skills.filter((skill) => text.includes(skill));
    value += Math.min(20, matchedSkills.length * 6);
    return value;
  }
}

function ruleReason(
  issue: IssueCandidate,
  profile: { languages: string[]; skills: string[]; experienceLevel: string | null },
  requestedLanguage?: string,
): string {
  const language = issue.language ?? requestedLanguage ?? profile.languages[0] ?? 'your stack';
  const level = issue.level ?? profile.experienceLevel ?? 'your level';
  const text = [issue.title, issue.repoDescription ?? '', ...issue.labels].join(' ').toLowerCase();
  const skill = profile.skills.find((entry) => entry.length >= 2 && text.includes(entry.toLowerCase()));
  const skillNote = skill ? ` It also mentions ${skill}, one of your skills.` : '';
  return `Matched on ${language} and ${level}. Recent activity ${issue.activityDays}d ago.${skillNote}`;
}

function mapRow(row: {
  id: string;
  number: number;
  repoFullName: string;
  organization: string | null;
  title: string;
  url: string;
  labels: string[];
  language: string | null;
  level: string | null;
  repoDescription: string | null;
  stars: number;
  activityAt: Date | null;
  fetchedAt: Date;
  assigned: boolean;
  state: string;
}): IssueCandidate {
  return {
    id: row.id,
    number: row.number,
    repoFullName: row.repoFullName,
    organization: row.organization,
    title: row.title,
    url: row.url,
    labels: row.labels,
    language: row.language,
    level: (row.level as IssueCandidate['level']) ?? null,
    repoDescription: row.repoDescription,
    stars: row.stars,
    updatedAt: (row.activityAt ?? row.fetchedAt).toISOString(),
    activityDays: row.activityAt
      ? Math.max(0, Math.floor((Date.now() - row.activityAt.getTime()) / 86_400_000))
      : 0,
    assigned: row.assigned,
    state: row.state,
  };
}
