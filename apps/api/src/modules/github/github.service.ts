import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import type {
  Contributor,
  ContributorDetail,
  DiscoveryFilters,
  ExperienceLevel,
  IssueCandidate,
  IssueContext,
  IssueDetails,
} from '@osh/contracts';
import type { GithubIssue } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { EncryptionService } from '../../infra/encryption.service';
import { AppError } from '../../common/errors';
import { getEnv } from '../../config/env';
import { buildStartCommands } from '../discovery/start-commands';
import { prerequisitesFor } from './prerequisites';

export interface GithubConnection {
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
}

export interface RepoContext {
  fullName: string;
  description: string;
  defaultBranch: string;
  stars: number;
  language: string;
  readme: string;
  contributing: string;
  tree: string[];
  languages: string[];
  topics: string[];
  commitSha: string | null;
  updatedAt: string;
  forks: number;
  openIssues: number;
  license: string | null;
  homepage: string | null;
  cloneUrl: string;
  sshUrl: string;
  htmlUrl: string;
  languageBytes: Record<string, number>;
}

export interface PullStatus {
  state: string;
  merged: boolean;
  url: string;
  title: string;
}

interface SearchResultCache {
  items: IssueCandidate[];
  total: number;
  fetchedAt: string;
}

interface RateLimitInfo {
  limited: boolean;
  until: string | null;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly encryption: EncryptionService,
  ) {}

  async status(userId: string): Promise<GithubConnection> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubLogin: true, githubTokenEnc: true, githubConnectedAt: true },
    });
    return {
      connected: Boolean(user?.githubTokenEnc),
      login: user?.githubLogin ?? null,
      connectedAt: user?.githubConnectedAt?.toISOString() ?? null,
    };
  }

  async connect(userId: string, token: string): Promise<GithubConnection> {
    const octokit = new Octokit({ auth: token });
    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      const encrypted = this.encryption.encrypt(token);
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          githubLogin: data.login,
          githubTokenEnc: encrypted,
          githubConnectedAt: new Date(),
          avatarUrl: data.avatar_url,
        },
        select: { githubLogin: true, githubConnectedAt: true },
      });
      return {
        connected: true,
        login: user.githubLogin,
        connectedAt: user.githubConnectedAt?.toISOString() ?? null,
      };
    } catch (error) {
      this.logger.warn(`github connect failed: ${error instanceof Error ? error.message : 'unknown'}`);
      throw new AppError('GITHUB_TOKEN_INVALID', 'GitHub rejected that token. Authorize again.', 400);
    }
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { githubLogin: null, githubTokenEnc: null, githubConnectedAt: null },
    });
  }

  private async token(userId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubTokenEnc: true },
    });
    if (!user?.githubTokenEnc) return undefined;
    return this.encryption.decrypt(user.githubTokenEnc);
  }

  private async client(userId: string): Promise<Octokit> {
    const token = await this.token(userId);
    if (token) return new Octokit({ auth: token, userAgent: 'opensource-helper' });
    if (getEnv().GITHUB_PUBLIC_FALLBACK) {
      return new Octokit({ userAgent: 'opensource-helper' });
    }
    throw new AppError('GITHUB_NOT_CONNECTED', 'Connect GitHub to search issues', 409);
  }

  /* ---------------------------------------------------------------------- */
  /* Discovery                                                               */
  /* ---------------------------------------------------------------------- */

  async searchIssues(
    userId: string,
    filters: DiscoveryFilters,
    page = 1,
    perPage = 20,
  ): Promise<{
    items: IssueCandidate[];
    total: number;
    cached: boolean;
    stale: boolean;
    fetchedAt: string;
    rateLimitedUntil: string | null;
  }> {
    const query = this.buildSearchQuery(filters);
    const cacheKey = `gh:pool:${hash(JSON.stringify({ query, page, perPage }))}`;
    const staleKey = `gh:stale:${hash(JSON.stringify({ query, page, perPage }))}`;
    const fresh = await this.redis.getJson<SearchResultCache>(cacheKey);
    if (fresh) {
      const excluded = await this.excludedIds(userId, fresh.items.map((item) => item.id));
      return {
        items: fresh.items.filter((item) => !excluded.has(item.id)),
        total: fresh.total,
        cached: true,
        stale: false,
        fetchedAt: fresh.fetchedAt,
        rateLimitedUntil: null,
      };
    }

    try {
      const octokit = await this.client(userId);
      const { data } = await octokit.rest.search.issuesAndPullRequests({
        q: query,
        sort: 'updated',
        order: 'desc',
        per_page: Math.min(perPage, 50),
        page,
      });
      const items: IssueCandidate[] = [];
      for (const raw of data.items) {
        const mapped = await this.persistIssue(raw);
        if (mapped) items.push(mapped);
      }
      const result: SearchResultCache = {
        items,
        total: data.total_count,
        fetchedAt: new Date().toISOString(),
      };
      await this.redis.setJson(cacheKey, result, 900);
      await this.redis.setJson(staleKey, result, 86_400);
      const excluded = await this.excludedIds(userId, items.map((item) => item.id));
      return {
        items: items.filter((item) => !excluded.has(item.id)),
        total: data.total_count,
        cached: false,
        stale: false,
        fetchedAt: result.fetchedAt,
        rateLimitedUntil: null,
      };
    } catch (error) {
      const rate = this.rateLimit(error);
      const stale = await this.redis.getJson<SearchResultCache>(staleKey);
      if (stale) {
        const excluded = await this.excludedIds(userId, stale.items.map((item) => item.id));
        return {
          items: stale.items.filter((item) => !excluded.has(item.id)),
          total: stale.total,
          cached: true,
          stale: true,
          fetchedAt: stale.fetchedAt,
          rateLimitedUntil: rate.until,
        };
      }
      if (rate.limited) {
        throw new AppError(
          'GITHUB_RATE_LIMITED',
          'GitHub is rate-limiting us. Try again in a few minutes.',
          429,
        );
      }
      this.logger.warn(`github search failed: ${error instanceof Error ? error.message : 'unknown'}`);
      throw new AppError(
        'GITHUB_UNAVAILABLE',
        'GitHub search is unavailable right now. Try again.',
        503,
      );
    }
  }

  private buildSearchQuery(filters: DiscoveryFilters): string {
    const parts = ['is:issue', 'is:open', 'no:assignee', 'archived:false'];
    if (filters.label) parts.push(`label:"${filters.label.replace(/"/g, '')}"`);
    if (filters.language) parts.push(`language:"${filters.language.replace(/"/g, '')}"`);
    if (filters.repo) parts.push(`repo:${filters.repo}`);
    else if (filters.org) parts.push(`org:${filters.org}`);
    if (filters.activityDays) {
      const since = new Date(Date.now() - filters.activityDays * 86_400_000);
      parts.push(`updated:>=${since.toISOString().slice(0, 10)}`);
    }
    return parts.join(' ');
  }

  private async excludedIds(userId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const [ignored, selected] = await Promise.all([
      this.prisma.ignoredIssue.findMany({
        where: { userId, issueId: { in: ids } },
        select: { issueId: true },
      }),
      this.prisma.selection.findMany({
        where: { userId, issueId: { in: ids } },
        select: { issueId: true },
      }),
    ]);
    return new Set([...ignored.map((row) => row.issueId), ...selected.map((row) => row.issueId)]);
  }

  private async persistIssue(raw: SearchItem): Promise<IssueCandidate | null> {
    const fullName = raw.repository_url?.split('/repos/')[1];
    if (!fullName || !raw.number) return null;
    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) return null;
    const id = `${fullName}#${raw.number}`;
    const labels = (raw.labels ?? [])
      .map((label) => (typeof label === 'string' ? label : label.name))
      .filter((label): label is string => Boolean(label));
    const level = inferLevel(labels);
    const repository = raw.repository as SearchRepository | undefined;
    const data = {
      number: raw.number,
      repoFullName: fullName,
      organization: owner,
      title: raw.title,
      body: raw.body ?? null,
      url: raw.html_url,
      state: raw.state,
      labels,
      language: repository?.language ?? null,
      level,
      assigned: Boolean(raw.assignee),
      repoDescription: repository?.description ?? null,
      stars: repository?.stargazers_count ?? 0,
      defaultBranch: repository?.default_branch ?? null,
      repoUpdatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
      activityAt: raw.updated_at ? new Date(raw.updated_at) : null,
      fetchedAt: new Date(),
    };
    const issue = await this.prisma.githubIssue.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    return mapGithubIssue(issue);
  }

  /* ---------------------------------------------------------------------- */
  /* Issue details                                                           */
  /* ---------------------------------------------------------------------- */

  async issueDetails(userId: string, issueId: string): Promise<IssueDetails> {
    const { owner, repo, number } = parseIssueId(issueId);
    let issue = await this.prisma.githubIssue.findUnique({ where: { id: issueId } });
    const stale = !issue?.fetchedAt || Date.now() - issue.fetchedAt.getTime() > 5 * 60_000;
    if (!issue || stale) {
      try {
        const octokit = await this.client(userId);
        const [{ data: ghIssue }, { data: repoData }, commentsResponse] = await Promise.all([
          octokit.rest.issues.get({ owner, repo, issue_number: number }),
          octokit.rest.repos.get({ owner, repo }),
          octokit.rest.issues
            .listComments({ owner, repo, issue_number: number, per_page: 20 })
            .catch(() => ({ data: [] })),
        ]);
        const labels = ghIssue.labels.map((label) =>
          typeof label === 'string' ? label : label.name ?? '',
        );
        const data = {
          number,
          repoFullName: `${owner}/${repo}`,
          organization: owner,
          title: ghIssue.title,
          body: ghIssue.body ?? null,
          url: ghIssue.html_url,
          state: ghIssue.state,
          labels,
          language: repoData.language,
          level: inferLevel(labels),
          assigned: Boolean(ghIssue.assignee),
          repoDescription: repoData.description,
          stars: repoData.stargazers_count,
          defaultBranch: repoData.default_branch,
          repoUpdatedAt: repoData.pushed_at ? new Date(repoData.pushed_at) : null,
          activityAt: ghIssue.updated_at ? new Date(ghIssue.updated_at) : null,
          fetchedAt: new Date(),
        };
        issue = await this.prisma.githubIssue.upsert({
          where: { id: issueId },
          create: { id: issueId, ...data },
          update: data,
        });
        const comments = commentsResponse.data.map((comment) => ({
          author: comment.user?.login ?? 'unknown',
          body: (comment.body ?? '').slice(0, 2000),
          createdAt: comment.created_at,
        }));
        return this.buildDetails(issue, repoData.default_branch, repoData.html_url, comments, userId);
      } catch (error) {
        if (!issue) {
          throw new AppError('ISSUE_NOT_FOUND', 'That issue is not available on GitHub', 404);
        }
        this.logger.warn(`issue refresh failed, serving cache: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    const comments = await this.fetchComments(userId, owner, repo, number).catch(() => []);
    return this.buildDetails(issue, issue.defaultBranch ?? 'main', issue.url, comments, userId);
  }

  private async fetchComments(
    userId: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<Array<{ author: string; body: string; createdAt: string }>> {
    const octokit = await this.client(userId);
    const { data } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: number,
      per_page: 20,
    });
    return data.map((comment) => ({
      author: comment.user?.login ?? 'unknown',
      body: (comment.body ?? '').slice(0, 2000),
      createdAt: comment.created_at,
    }));
  }

  private async buildDetails(
    issue: GithubIssue,
    defaultBranch: string,
    repoUrl: string,
    comments: Array<{ author: string; body: string; createdAt: string }>,
    userId: string,
  ): Promise<IssueDetails> {
    const [reason, saved, ignored, selected] = await Promise.all([
      this.prisma.recommendation.findFirst({
        where: { userId, issueId: issue.id },
        orderBy: { createdAt: 'desc' },
        select: { reason: true },
      }),
      this.prisma.savedItem.findFirst({ where: { userId, issueId: issue.id }, select: { id: true } }),
      this.prisma.ignoredIssue.findUnique({
        where: { userId_issueId: { userId, issueId: issue.id } },
        select: { id: true },
      }),
      this.prisma.selection.findUnique({
        where: { userId_issueId: { userId, issueId: issue.id } },
        select: { id: true },
      }),
    ]);
    const technologies = [issue.language, ...issue.labels.filter((label) => !/good first|help wanted|bug|documentation/i.test(label))]
      .filter((value): value is string => Boolean(value))
      .slice(0, 6);
    return {
      issue: mapGithubIssue(issue),
      body: issue.body ?? '',
      comments,
      requirements: {
        technologies,
        knowledge: issue.labels.slice(0, 6),
        level: issue.level,
        prerequisites: prerequisitesFor(
          { repoFullName: issue.repoFullName, language: issue.language, labels: issue.labels },
          defaultBranch,
        ),
      },
      repo: {
        fullName: issue.repoFullName,
        description: issue.repoDescription,
        url: repoUrl,
        stars: issue.stars,
        defaultBranch,
        language: issue.language,
      },
      reason: reason?.reason ?? null,
      saved: Boolean(saved),
      ignored: Boolean(ignored),
      selected: Boolean(selected),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Repository context                                                      */
  /* ---------------------------------------------------------------------- */

  async repoContext(userId: string, repoFullName: string): Promise<RepoContext> {
    const key = `gh:repo:v2:${repoFullName}`;
    const cached = await this.redis.getJson<RepoContext>(key);
    if (cached) return cached;
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) throw new AppError('INVALID_REPO', 'Use owner/name', 400);
    try {
      const octokit = await this.client(userId);
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
      const [readme, contributing, tree, languageBytes, topics] = await Promise.all([
        octokit.rest.repos
          .getReadme({ owner, repo })
          .then((response) => decodeBase64(response.data.content))
          .catch(() => ''),
        octokit.rest.repos
          .getContent({ owner, repo, path: 'CONTRIBUTING.md' })
          .then((response) => {
            const data = response.data;
            if (Array.isArray(data) || !('content' in data)) return '';
            return decodeBase64(data.content);
          })
          .catch(() => ''),
        octokit.rest.git
          .getTree({ owner, repo, tree_sha: repoData.default_branch, recursive: '1' })
          .then((response) =>
            response.data.tree
              .filter((entry) => entry.type === 'blob')
              .slice(0, 300)
              .map((entry) => entry.path)
              .filter((path): path is string => Boolean(path)),
          )
          .catch(() => [] as string[]),
        octokit.rest.repos
          .listLanguages({ owner, repo })
          .then((response) => response.data)
          .catch(() => ({}) as Record<string, number>),
        octokit.rest.repos
          .getAllTopics({ owner, repo })
          .then((response) => response.data.names.filter((name): name is string => Boolean(name)))
          .catch(() => [] as string[]),
      ]);
      const branch = await octokit.rest.repos.getBranch({ owner, repo, branch: repoData.default_branch }).catch(() => null);
      const context: RepoContext = {
        fullName: repoFullName,
        description: repoData.description ?? '',
        defaultBranch: repoData.default_branch,
        stars: repoData.stargazers_count,
        language: repoData.language ?? '',
        readme: readme.slice(0, 14_000),
        contributing: contributing.slice(0, 8_000),
        tree,
        languages: Object.keys(languageBytes),
        topics,
        commitSha: branch?.data.commit.sha ?? null,
        updatedAt: (repoData.pushed_at ?? new Date().toISOString()).toString(),
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        license: repoData.license?.spdx_id ?? null,
        homepage: repoData.homepage ?? null,
        cloneUrl: repoData.clone_url,
        sshUrl: repoData.ssh_url,
        htmlUrl: repoData.html_url,
        languageBytes,
      };
      await this.redis.setJson(key, context, 900);
      return context;
    } catch (error) {
      this.logger.warn(`repo context failed: ${error instanceof Error ? error.message : 'unknown'}`);
      throw new AppError('REPOSITORY_UNAVAILABLE', 'The repository could not be read from GitHub', 503);
    }
  }

  async issueContext(userId: string, issueId: string): Promise<IssueContext> {
    const cacheKey = `gh:issue-context:${issueId}`;
    const cached = await this.redis.getJson<IssueContext>(cacheKey);
    if (cached) return cached;

    const { owner, repo, number } = parseIssueId(issueId);
    let issue = await this.prisma.githubIssue.findUnique({ where: { id: issueId } });
    if (!issue) {
      await this.issueDetails(userId, issueId);
      issue = await this.prisma.githubIssue.findUnique({ where: { id: issueId } });
      if (!issue) throw AppError.notFound('That issue is not available on GitHub');
    }

    const [context, ghIssue, comments] = await Promise.all([
      this.repoContext(userId, `${owner}/${repo}`),
      this.client(userId).then((octokit) =>
        octokit.rest.issues.get({ owner, repo, issue_number: number }),
      ),
      this.fetchCommentsDetailed(userId, owner, repo, number).catch(() => []),
    ]);

    const scripts = context.tree.includes('package.json')
      ? await this.readPackageScripts(userId, owner, repo).catch(() => ({}) as Record<string, string>)
      : {};
    const commands = buildStartCommands({
      repoFullName: context.fullName,
      cloneUrl: context.cloneUrl,
      defaultBranch: context.defaultBranch,
      issueNumber: number,
      files: context.tree,
      scripts,
    });
    const totalBytes = Object.values(context.languageBytes).reduce((sum, bytes) => sum + bytes, 0);
    const languages = Object.entries(context.languageBytes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, bytes]) => ({
        name,
        percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
      }));
    const readmeUrl = `${context.htmlUrl}#readme`;
    const contributingUrl = context.contributing
      ? `${context.htmlUrl}/blob/${context.defaultBranch}/CONTRIBUTING.md`
      : null;

    const result: IssueContext = {
      issue: {
        id: issue.id,
        number,
        title: ghIssue.data.title,
        body: (ghIssue.data.body ?? issue.body ?? '').slice(0, 12_000),
        url: ghIssue.data.html_url,
        state: ghIssue.data.state,
        labels: ghIssue.data.labels.map((label) =>
          typeof label === 'string' ? label : (label.name ?? ''),
        ),
        author: ghIssue.data.user?.login ?? null,
        assignee: ghIssue.data.assignee?.login ?? null,
        createdAt: ghIssue.data.created_at ?? null,
        updatedAt: ghIssue.data.updated_at ?? null,
      },
      comments,
      repo: {
        fullName: context.fullName,
        url: context.htmlUrl,
        description: context.description || null,
        defaultBranch: context.defaultBranch,
        stars: context.stars,
        forks: context.forks,
        openIssues: context.openIssues,
        topics: context.topics,
        language: context.language || null,
        languages,
        license: context.license,
        homepage: context.homepage,
        cloneUrl: context.cloneUrl,
        sshUrl: context.sshUrl,
        pushedAt: context.updatedAt,
        readmeUrl,
        contributingUrl,
      },
      readme: context.readme.slice(0, 8_000),
      contributing: context.contributing.slice(0, 6_000),
      files: context.tree,
      commands,
      links: {
        repo: context.htmlUrl,
        issue: ghIssue.data.html_url,
        readme: readmeUrl,
        contributing: contributingUrl,
      },
    };
    await this.redis.setJson(cacheKey, result, 300);
    return result;
  }

  private async readPackageScripts(
    userId: string,
    owner: string,
    repo: string,
  ): Promise<Record<string, string>> {
    const octokit = await this.client(userId);
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: 'package.json' });
    if (Array.isArray(data) || !('content' in data)) return {};
    const parsed = JSON.parse(decodeBase64(data.content)) as {
      scripts?: Record<string, string>;
    };
    return parsed.scripts ?? {};
  }

  private async fetchCommentsDetailed(
    userId: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<Array<{ author: string; body: string; createdAt: string; url: string | null }>> {
    const octokit = await this.client(userId);
    const { data } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: number,
      per_page: 30,
    });
    return data.map((comment) => ({
      author: comment.user?.login ?? 'unknown',
      body: (comment.body ?? '').slice(0, 3000),
      createdAt: comment.created_at,
      url: comment.html_url ?? null,
    }));
  }

  async issueSnapshot(
    userId: string,
    repoFullName: string,
    number: number,
  ): Promise<{ state: string; assigned: boolean }> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) throw new AppError('INVALID_REPO', 'Use owner/name', 400);
    const octokit = await this.client(userId);
    const { data } = await octokit.rest.issues.get({ owner, repo, issue_number: number });
    return { state: data.state, assigned: Boolean(data.assignee) };
  }

  /* ---------------------------------------------------------------------- */
  /* Pull requests                                                           */
  /* ---------------------------------------------------------------------- */

  async pullStatus(userId: string, prUrl: string): Promise<PullStatus> {
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(prUrl);
    if (!match) throw new AppError('INVALID_PR_URL', 'Use a GitHub pull request URL', 400);
    const [, owner, repo, number] = match;
    if (!owner || !repo || !number) throw new AppError('INVALID_PR_URL', 'Use a GitHub pull request URL', 400);
    const octokit = await this.client(userId);
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: Number(number),
    });
    return {
      state: data.merged_at ? 'merged' : data.state,
      merged: Boolean(data.merged_at),
      url: data.html_url,
      title: data.title,
    };
  }

  async pullActivity(
    userId: string,
    prUrl: string,
    since: Date,
  ): Promise<
    Array<{
      id: string;
      type: 'review' | 'comment';
      author: string;
      body: string;
      createdAt: string;
    }>
  > {
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(prUrl);
    if (!match) return [];
    const [, owner, repo, number] = match;
    if (!owner || !repo || !number) return [];
    const octokit = await this.client(userId);
    const [reviews, comments] = await Promise.all([
      octokit.rest.pulls
        .listReviews({ owner, repo, pull_number: Number(number), per_page: 30 })
        .then((response) => response.data)
        .catch(() => []),
      octokit.rest.issues
        .listComments({ owner, repo, issue_number: Number(number), per_page: 30 })
        .then((response) => response.data)
        .catch(() => []),
    ]);
    const events = [
      ...reviews.map((review) => ({
        id: `review-${review.id}`,
        type: 'review' as const,
        author: review.user?.login ?? 'unknown',
        body: review.body ?? '',
        createdAt: review.submitted_at ?? new Date().toISOString(),
      })),
      ...comments.map((comment) => ({
        id: `comment-${comment.id}`,
        type: 'comment' as const,
        author: comment.user?.login ?? 'unknown',
        body: comment.body ?? '',
        createdAt: comment.created_at,
      })),
    ];
    return events
      .filter((event) => new Date(event.createdAt).getTime() >= since.getTime())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async findLinkedPullRequest(
    userId: string,
    repoFullName: string,
    issueNumber: number,
    githubLogin: string | null,
  ): Promise<PullStatus | null> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) return null;
    try {
      const octokit = await this.client(userId);
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/timeline', {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      });
      const events = data as Array<Record<string, unknown>>;
      const candidates = events.filter((event) => {
        if (event.event !== 'cross-referenced') return false;
        const source = event.source as { issue?: { pull_request?: unknown; user?: { login?: string }; number?: number } } | undefined;
        if (!source?.issue?.pull_request) return false;
        if (githubLogin && source.issue.user?.login && source.issue.user.login !== githubLogin) return false;
        return true;
      });
      const latest = candidates.at(-1);
      if (!latest) return null;
      const source = latest.source as { issue?: { number?: number } };
      const prNumber = source.issue?.number;
      if (!prNumber) return null;
      return this.pullStatus(userId, `https://github.com/${owner}/${repo}/pull/${prNumber}`);
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Contributor search                                                      */
  /* ---------------------------------------------------------------------- */

  async searchContributors(
    userId: string,
    input: { org?: string; repo?: string; language?: string; topic?: string },
  ): Promise<{ items: Contributor[]; cached: boolean; fetchedAt: string }> {
    if (!input.org && !input.repo) {
      throw new AppError('MISSING_SCOPE', 'Enter an organization or an owner/repo', 400);
    }
    const key = `gh:contributors:${hash(JSON.stringify(input))}`;
    const cached = await this.redis.getJson<{ items: Contributor[]; fetchedAt: string }>(key);
    if (cached) return { ...cached, cached: true };
    const octokit = await this.client(userId);
    const repos: Array<{ owner: string; repo: string; language: string | null; topics: string[] }> = [];
    if (input.repo) {
      const [owner, repo] = input.repo.split('/');
      if (!owner || !repo) throw new AppError('INVALID_REPO', 'Use owner/name', 400);
      const { data } = await octokit.rest.repos.get({ owner, repo });
      const topics = await octokit.rest.repos
        .getAllTopics({ owner, repo })
        .then((response) => response.data.names)
        .catch(() => [] as string[]);
      repos.push({ owner, repo, language: data.language, topics });
    } else if (input.org) {
      const { data } = await octokit.rest.repos.listForOrg({
        org: input.org,
        sort: 'pushed',
        per_page: 5,
      });
      for (const repo of data) {
        const topics = await octokit.rest.repos
          .getAllTopics({ owner: input.org, repo: repo.name })
          .then((response) => response.data.names.filter((name): name is string => Boolean(name)))
          .catch(() => [] as string[]);
        repos.push({ owner: input.org, repo: repo.name, language: repo.language ?? null, topics });
      }
    }

    const aggregate = new Map<
      string,
      {
        login: string;
        avatarUrl: string;
        contributions: number;
        languages: Set<string>;
        topics: Set<string>;
        repos: Set<string>;
        activity: number[];
      }
    >();
    for (const repoRef of repos) {
      const contributors = await octokit.rest.repos
        .listContributors({
          owner: repoRef.owner,
          repo: repoRef.repo,
          per_page: 30,
        })
        .then((response) => response.data)
        .catch(() => []);
      const participation = await octokit.rest.repos
        .getParticipationStats({ owner: repoRef.owner, repo: repoRef.repo })
        .then((response) => (response.data.all ?? []).slice(-12))
        .catch(() => [] as number[]);
      for (const contributor of contributors) {
        if (!('login' in contributor) || !contributor.login) continue;
        const existing = aggregate.get(contributor.login) ?? {
          login: contributor.login,
          avatarUrl: contributor.avatar_url ?? `https://github.com/${contributor.login}.png`,
          contributions: 0,
          languages: new Set<string>(),
          topics: new Set<string>(),
          repos: new Set<string>(),
          activity: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        };
        existing.contributions += contributor.contributions;
        if (repoRef.language) existing.languages.add(repoRef.language);
        for (const topic of repoRef.topics) existing.topics.add(topic);
        existing.repos.add(`${repoRef.owner}/${repoRef.repo}`);
        existing.activity = existing.activity.map((value, index) => value + (participation[index] ?? 0));
        aggregate.set(contributor.login, existing);
      }
    }

    const wantedLanguage = input.language?.toLowerCase();
    const wantedTopic = input.topic?.toLowerCase();
    const logins = [...aggregate.keys()];
    const profiles = await this.prisma.publicProfile.findMany({
      where: { user: { githubLogin: { in: logins } } },
      include: { user: { select: { id: true, name: true, githubLogin: true } } },
    });
    const profileByLogin = new Map(profiles.map((profile) => [profile.user.githubLogin, profile]));

    const items: Contributor[] = [...aggregate.values()]
      .filter((entry) => {
        if (wantedLanguage && ![...entry.languages].some((lang) => lang.toLowerCase() === wantedLanguage)) {
          return false;
        }
        if (wantedTopic && ![...entry.topics].some((topic) => topic.toLowerCase() === wantedTopic)) {
          return false;
        }
        return true;
      })
      .map((entry) => {
        const profile = profileByLogin.get(entry.login);
        return {
          login: entry.login,
          name: profile?.user.name ?? null,
          avatarUrl: entry.avatarUrl,
          githubUrl: `https://github.com/${entry.login}`,
          contributions: entry.contributions,
          languages: [...entry.languages],
          topics: [...entry.topics].slice(0, 6),
          score:
            entry.contributions +
            (wantedLanguage ? 50 : 0) +
            (wantedTopic ? 25 : 0),
          platformHandle: profile?.published ? profile.handle : null,
          platformUserId: profile?.published && profile?.mentorOptIn ? profile.userId : null,
          optedIn: Boolean(profile?.mentorOptIn && profile?.published),
          activity: entry.activity,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    const result = { items, fetchedAt: new Date().toISOString() };
    await this.redis.setJson(key, result, 900);
    return { ...result, cached: false };
  }

  async contributorDetail(userId: string, login: string): Promise<ContributorDetail> {
    const key = `gh:contributor:${login}`;
    const cached = await this.redis.getJson<ContributorDetail>(key);
    if (cached) return cached;
    const octokit = await this.client(userId);
    const { data: user } = await octokit.rest.users.getByUsername({ username: login });
    const [merged, reviews, commits] = await Promise.all([
      octokit.rest.search
        .issuesAndPullRequests({ q: `is:pr is:merged author:${login}`, per_page: 1 })
        .then((response) => response.data.total_count)
        .catch(() => 0),
      octokit.rest.search
        .issuesAndPullRequests({ q: `is:pr reviewed-by:${login}`, per_page: 1 })
        .then((response) => response.data.total_count)
        .catch(() => 0),
      octokit.rest.search
        .commits({ q: `author:${login}`, per_page: 1 })
        .then((response) => response.data.total_count)
        .catch(() => 0),
    ]);
    const repos = await octokit.rest.repos
      .listForUser({ username: login, sort: 'pushed', per_page: 5 })
      .then((response) => response.data)
      .catch(() => []);
    const languages = new Set<string>();
    for (const repo of repos) {
      if (repo.language) languages.add(repo.language);
    }
    const profile = await this.prisma.publicProfile.findFirst({
      where: { user: { githubLogin: login } },
      include: { user: { select: { id: true, name: true } } },
    });
    const detail: ContributorDetail = {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      githubUrl: user.html_url,
      contributions: merged + commits,
      languages: [...languages],
      topics: repos.flatMap((repo) => repo.topics ?? []).slice(0, 8),
      score: merged + commits,
      platformHandle: profile?.published ? profile.handle : null,
      platformUserId: profile?.published && profile?.mentorOptIn ? profile.userId : null,
      optedIn: Boolean(profile?.mentorOptIn && profile?.published),
      activity: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      mergedPullRequests: merged,
      commits,
      reviews,
      expertise: [...languages],
    };
    await this.redis.setJson(key, detail, 900);
    return detail;
  }

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */

  private rateLimit(error: unknown): RateLimitInfo {
    if (!error || typeof error !== 'object') return { limited: false, until: null };
    const candidate = error as {
      status?: number;
      response?: { headers?: Record<string, string | number | undefined> };
    };
    const remaining = candidate.response?.headers?.['x-ratelimit-remaining'];
    const reset = candidate.response?.headers?.['x-ratelimit-reset'];
    const retryAfter = candidate.response?.headers?.['retry-after'];
    const limited =
      candidate.status === 429 ||
      (candidate.status === 403 && String(remaining) === '0');
    if (!limited) return { limited: false, until: null };
    let until: Date | null = null;
    if (typeof reset === 'string' || typeof reset === 'number') {
      until = new Date(Number(reset) * 1000);
    } else if (retryAfter) {
      until = new Date(Date.now() + Number(retryAfter) * 1000);
    }
    return { limited: true, until: until?.toISOString() ?? null };
  }
}

function inferLevel(labels: string[]): ExperienceLevel | null {
  const lowered = labels.map((label) => label.toLowerCase());
  if (lowered.some((label) => label.includes('good first issue') || label.includes('beginner'))) {
    return 'BEGINNER';
  }
  if (lowered.some((label) => label.includes('advanced') || label.includes('expert'))) {
    return 'ADVANCED';
  }
  if (lowered.some((label) => label.includes('help wanted') || label.includes('intermediate'))) {
    return 'INTERMEDIATE';
  }
  return null;
}

export function mapGithubIssue(issue: GithubIssue): IssueCandidate {
  const activityDays = issue.activityAt
    ? Math.max(0, Math.floor((Date.now() - issue.activityAt.getTime()) / 86_400_000))
    : 0;
  return {
    id: issue.id,
    number: issue.number,
    repoFullName: issue.repoFullName,
    organization: issue.organization,
    title: issue.title,
    url: issue.url,
    labels: issue.labels,
    language: issue.language,
    level: (issue.level as ExperienceLevel | null) ?? null,
    repoDescription: issue.repoDescription,
    stars: issue.stars,
    updatedAt: (issue.activityAt ?? issue.fetchedAt).toISOString(),
    activityDays,
    assigned: issue.assigned,
    state: issue.state,
  };
}

function parseIssueId(id: string): { owner: string; repo: string; number: number } {
  const match = /^([\w.-]+)\/([\w.-]+)#(\d+)$/.exec(id);
  if (!match) throw new AppError('INVALID_ISSUE', 'Use owner/repo#number', 400);
  const [, owner, repo, number] = match;
  if (!owner || !repo || !number) throw new AppError('INVALID_ISSUE', 'Use owner/repo#number', 400);
  return { owner, repo, number: Number(number) };
}

function decodeBase64(value: string): string {
  return Buffer.from(value.replace(/\n/g, ''), 'base64').toString('utf8');
}

function hash(value: string): string {
  let hashValue = 0;
  for (let index = 0; index < value.length; index += 1) {
    hashValue = (hashValue * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hashValue).toString(36);
}

interface SearchLabel {
  name?: string;
}

interface SearchRepository {
  language?: string | null;
  description?: string | null;
  stargazers_count?: number;
  default_branch?: string;
}

interface SearchItem {
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  state: string;
  labels?: Array<string | SearchLabel>;
  assignee?: unknown;
  updated_at?: string;
  repository_url?: string;
  repository?: SearchRepository;
}
