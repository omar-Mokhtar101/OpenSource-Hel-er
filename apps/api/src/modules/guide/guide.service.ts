import { Injectable, Logger } from '@nestjs/common';
import type { ChatMessage, GuideConversation, GuideReply } from '@osh/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../common/errors';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { GeminiService } from '../ai/gemini.service';
import { GuardrailService } from '../ai/guardrail.service';
import { AI_FEATURE, GUIDE_SYSTEM, guidePrompt } from '../ai/prompts';
import { GithubService } from '../github/github.service';

@Injectable()
export class GuideService {
  private readonly logger = new Logger(GuideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiSettings: AiSettingsService,
    private readonly aiUsage: AiUsageService,
    private readonly gemini: GeminiService,
    private readonly guardrail: GuardrailService,
    private readonly github: GithubService,
  ) {}

  async conversation(userId: string, issueId: string): Promise<GuideConversation> {
    const selection = await this.requireSelection(userId, issueId);
    const conversation = await this.ensureConversation(userId, issueId);
    const usage = await this.aiSettings.usageForUser(userId);
    const settings = await this.aiSettings.get();
    return {
      id: conversation.id,
      issueId,
      issueTitle: selection.issue.title,
      messages: conversation.messages.map(toMessage),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      usage: { tokensUsedThisMonth: usage, maxTokensPerUser: settings.maxTokensPerUser },
    };
  }

  async send(userId: string, issueId: string, content: string): Promise<GuideReply> {
    const selection = await this.requireSelection(userId, issueId);
    const conversation = await this.ensureConversation(userId, issueId);
    const askedForSolution = this.guardrail.asksForSolution(content);

    if (askedForSolution) {
      await this.prisma.chatMessage.create({
        data: { conversationId: conversation.id, role: 'USER', content },
      });
      const blocked = this.guardrail.finalize('', { askedForSolution: true });
      const guideMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'GUIDE',
          content: blocked.content,
          guardrailOutcome: blocked.outcome,
          tokens: 0,
        },
      });
      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      const usage = await this.aiSettings.usageForUser(userId);
      const settings = await this.aiSettings.get();
      return {
        message: toMessage(guideMessage),
        usage: { tokensUsedThisMonth: usage, maxTokensPerUser: settings.maxTokensPerUser },
        refusal: true,
        strippedCode: false,
      };
    }

    const allowance = await this.aiUsage.assertAllowed(userId, AI_FEATURE.guide, 900);
    await this.prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: 'USER', content },
    });

    const [onboarding, repoContext] = await Promise.all([
      this.prisma.issueOnboarding.findUnique({ where: { issueId } }).catch(() => null),
      this.github.repoContext(userId, selection.issue.repoFullName).catch(() => null),
    ]);
    const previous = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 9,
    });
    const history = previous
      .reverse()
      .map((message) => `${message.role === 'USER' ? 'Developer' : 'Guide'}: ${message.content}`)
      .join('\n');

    let raw = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let model = 'fallback';
    try {
      const result = await this.gemini.generateText({
        system: GUIDE_SYSTEM,
        prompt: guidePrompt({
          repoFullName: selection.issue.repoFullName,
          issueTitle: selection.issue.title,
          issueSummary: [
            selection.issue.body?.slice(0, 4000) ?? '',
            onboarding ? `Onboarding summary: ${onboarding.summary.slice(0, 1200)}` : '',
            repoContext ? `Repository files: ${repoContext.tree.slice(0, 80).join(', ')}` : '',
          ].join('\n'),
          onboarding: onboarding?.researchTopics.join(', ') ?? 'read the README and CONTRIBUTING.md',
          history,
          question: content,
        }),
        temperature: allowance.settings.temperature,
        maxOutputTokens: 700,
        timeoutMs: 8_000,
        model: 'gemini-2.5-flash-lite',
      });
      raw = result.text;
      promptTokens = result.promptTokens;
      completionTokens = result.completionTokens;
      model = result.model;
    } catch (error) {
      this.logger.warn(
        `guide unavailable for user ${userId} conversation ${conversation.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      throw new AppError(
        'AI_UNAVAILABLE',
        'The guide is offline because the AI provider did not answer. Your history is safe — retry in a minute. If it keeps failing, check the API logs for this request id.',
        503,
        [{ message: 'Provider: Gemini. Logs: docker compose logs api | grep <requestId>' }],
      );
    }

    await this.aiUsage.record({
      userId,
      feature: AI_FEATURE.guide,
      model,
      promptTokens,
      completionTokens,
      requestId: conversation.id,
    });

    const finalized = this.guardrail.finalize(raw, { askedForSolution });
    const guideMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'GUIDE',
        content: finalized.content,
        guardrailOutcome: finalized.outcome,
        tokens: completionTokens,
      },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    const usage = await this.aiSettings.usageForUser(userId);
    const settings = await this.aiSettings.get();
    return {
      message: toMessage(guideMessage),
      usage: { tokensUsedThisMonth: usage, maxTokensPerUser: settings.maxTokensPerUser },
      refusal: finalized.refusal,
      strippedCode: finalized.strippedCode,
    };
  }

  private async requireSelection(userId: string, issueId: string) {
    const selection = await this.prisma.selection.findUnique({
      where: { userId_issueId: { userId, issueId } },
      include: { issue: true },
    });
    if (!selection) throw AppError.notFound('Select that issue before opening the guide');
    return selection;
  }

  private async ensureConversation(userId: string, issueId: string) {
    const existing = await this.prisma.chatConversation.findUnique({
      where: { userId_issueId: { userId, issueId } },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) return existing;
    return this.prisma.chatConversation.create({
      data: { userId, issueId },
      include: { messages: true },
    });
  }
}

function toMessage(row: {
  id: string;
  role: string;
  content: string;
  guardrailOutcome: string | null;
  tokens: number | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: row.id,
    role: row.role === 'USER' ? 'USER' : 'GUIDE',
    content: row.content,
    guardrailOutcome: (row.guardrailOutcome as ChatMessage['guardrailOutcome']) ?? null,
    tokens: row.tokens,
    createdAt: row.createdAt.toISOString(),
  };
}
