import { Injectable } from '@nestjs/common';
import type {
  ProgressHistory,
  ProgressStatus,
  ProgressSummary,
  Selection,
  SelectIssue,
  UpdateProgress,
} from '@osh/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../common/errors';
import { mapGithubIssue } from '../github/github.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueService, QUEUES } from '../../infra/queue.service';

const STATUS_LABEL: Record<ProgressStatus, string> = {
  IN_PROGRESS: 'In Progress',
  PR_OPEN: 'PR Open',
  MERGED: 'Merged',
  PAUSED: 'Paused',
  IGNORED: 'Ignored',
};

@Injectable()
export class SelectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly queue: QueueService,
  ) {}

  async select(userId: string, input: SelectIssue): Promise<Selection> {
    if (!input.confirmed) throw new AppError('CONFIRM_REQUIRED', 'Confirm the selection first');
    const issue = await this.prisma.githubIssue.findUnique({ where: { id: input.issueId } });
    if (!issue) throw AppError.notFound('That issue is no longer available');
    if (issue.state !== 'open') {
      throw AppError.conflict('ISSUE_CLOSED', 'That issue is closed. Pick another one.');
    }
    const existing = await this.prisma.selection.findUnique({
      where: { userId_issueId: { userId, issueId: input.issueId } },
    });
    if (existing) {
      throw AppError.conflict('ALREADY_SELECTED', 'You are already working on this issue');
    }
    const active = await this.prisma.selection.findFirst({
      where: { userId, status: { in: ['IN_PROGRESS', 'PR_OPEN'] } },
      include: { issue: { select: { title: true } } },
    });
    if (active) {
      throw AppError.conflict(
        'ACTIVE_ISSUE_EXISTS',
        `Finish or pause "${active.issue.title}" before starting another issue.`,
      );
    }
    const selection = await this.prisma.$transaction(async (tx) => {
      await tx.ignoredIssue.deleteMany({ where: { userId, issueId: input.issueId } });
      const created = await tx.selection.create({
        data: {
          userId,
          issueId: input.issueId,
          status: 'IN_PROGRESS',
          events: {
            create: {
              status: 'IN_PROGRESS',
              source: 'MANUAL',
              note: 'Selected by the developer',
            },
          },
        },
        include: { issue: true },
      });
      return created;
    });
    await this.notifications
      .create({
        userId,
        type: 'SYSTEM',
        title: 'Issue added to your progress',
        body: `"${issue.title}" is now In Progress. The guide is ready when you are.`,
        link: `/issues/${encodeURIComponent(issue.id)}`,
        dedupeKey: `selection:${selection.id}`,
      })
      .catch(() => null);
    return this.toSelection(selection);
  }

  async ignore(userId: string, issueId: string): Promise<{ ok: true }> {
    const [issue, selection] = await Promise.all([
      this.prisma.githubIssue.findUnique({ where: { id: issueId } }),
      this.prisma.selection.findUnique({ where: { userId_issueId: { userId, issueId } } }),
    ]);
    if (!issue) throw AppError.notFound('That issue is no longer available');
    if (selection) {
      throw AppError.conflict('ALREADY_SELECTED', 'You are already working on this issue');
    }
    await this.prisma.ignoredIssue.upsert({
      where: { userId_issueId: { userId, issueId } },
      create: { userId, issueId },
      update: {},
    });
    return { ok: true };
  }

  async progress(userId: string): Promise<ProgressSummary> {
    const selections = await this.prisma.selection.findMany({
      where: { userId },
      include: { issue: true },
      orderBy: { selectedAt: 'desc' },
    });
    const counts = { inProgress: 0, prOpen: 0, merged: 0, ignored: 0, paused: 0 };
    for (const selection of selections) {
      if (selection.status === 'IN_PROGRESS') counts.inProgress += 1;
      if (selection.status === 'PR_OPEN') counts.prOpen += 1;
      if (selection.status === 'MERGED') counts.merged += 1;
      if (selection.status === 'PAUSED') counts.paused += 1;
    }
    counts.ignored = await this.prisma.ignoredIssue.count({ where: { userId } });
    const lastSyncedAt = selections
      .map((selection) => selection.lastSyncedAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      counts,
      items: selections.map((selection) => this.toSelection(selection)),
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    };
  }

  async history(userId: string, selectionId: string): Promise<ProgressHistory> {
    const selection = await this.prisma.selection.findUnique({
      where: { id: selectionId },
      include: { issue: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!selection) throw AppError.notFound('Selection not found');
    if (selection.userId !== userId) throw AppError.notFound('Selection not found');
    return {
      selection: this.toSelection(selection),
      events: selection.events.map((event) => ({
        id: event.id,
        status: event.status,
        source: event.source,
        prUrl: event.prUrl,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async update(userId: string, selectionId: string, input: UpdateProgress): Promise<Selection> {
    const selection = await this.prisma.selection.findUnique({
      where: { id: selectionId },
      include: { issue: true },
    });
    if (!selection) throw AppError.notFound('Selection not found');
    if (selection.userId !== userId) throw AppError.notFound('Selection not found');
    if (!input.status && input.prUrl === undefined && input.note === undefined) {
      throw new AppError('NOTHING_TO_UPDATE', 'Change a status, a PR link or a note', 400);
    }
    const status: ProgressStatus =
      input.status ??
      (input.prUrl ? 'PR_OPEN' : selection.status);
    if (selection.status === 'MERGED' && status !== 'MERGED') {
      throw AppError.conflict('ALREADY_MERGED', 'A merged contribution cannot move backwards');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.selection.update({
        where: { id: selectionId },
        data: {
          status,
          prUrl: input.prUrl === undefined ? selection.prUrl : input.prUrl,
        },
        include: { issue: true },
      });
      const event = await tx.progressEvent.create({
        data: {
          selectionId,
          status,
          source: 'MANUAL',
          prUrl: input.prUrl === undefined ? selection.prUrl : input.prUrl,
          note: input.note ?? null,
        },
      });
      return { saved, event };
    });
    if (selection.status !== status) {
      await this.notifications
        .create({
          userId,
          type: 'SYSTEM',
          title: `Moved to ${STATUS_LABEL[status]}`,
          body: `"${selection.issue.title}" is now ${STATUS_LABEL[status]}.`,
          link: `/issues/${encodeURIComponent(selection.issue.id)}?tab=progress`,
          dedupeKey: `progress:${selectionId}:${updated.event.id}`,
        })
        .catch(() => null);
    }
    if (['PR_OPEN', 'MERGED'].includes(status) && selection.status !== status) {
      await this.queue.add(
        QUEUES.gamification,
        { userId },
        `badge:${userId}:${selectionId}`,
      );
    }
    return this.toSelection(updated.saved);
  }

  async active(userId: string): Promise<Selection | null> {
    const selection = await this.prisma.selection.findFirst({
      where: { userId, status: { in: ['IN_PROGRESS', 'PR_OPEN'] } },
      include: { issue: true },
      orderBy: { selectedAt: 'desc' },
    });
    return selection ? this.toSelection(selection) : null;
  }

  private toSelection(selection: {
    id: string;
    status: string;
    prUrl: string | null;
    selectedAt: Date;
    updatedAt: Date;
    lastSyncedAt: Date | null;
    issue: Parameters<typeof mapGithubIssue>[0];
  }): Selection {
    return {
      id: selection.id,
      issue: mapGithubIssue(selection.issue),
      status: selection.status as ProgressStatus,
      prUrl: selection.prUrl,
      selectedAt: selection.selectedAt.toISOString(),
      updatedAt: selection.updatedAt.toISOString(),
      daysSinceSelected: Math.max(
        0,
        Math.floor((Date.now() - selection.selectedAt.getTime()) / 86_400_000),
      ),
      lastSyncedAt: selection.lastSyncedAt?.toISOString() ?? null,
    };
  }
}
