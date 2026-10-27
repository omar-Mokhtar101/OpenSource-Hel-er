import { AppError } from '../../common/errors';
import { DiscoveryService, heuristicRank } from './discovery.service';

const candidates = [1, 2, 3].map((n) => ({
  id: `test/repo#${n}`,
  number: n,
  repoFullName: 'test/repo',
  organization: 'test',
  title: `Issue ${n}`,
  url: `https://github.com/test/repo/issues/${n}`,
  labels: ['good first issue'],
  language: 'TypeScript',
  level: 'BEGINNER' as const,
  repoDescription: 'test',
  stars: 10,
  updatedAt: new Date().toISOString(),
  activityDays: 1,
  assigned: false,
  state: 'open',
}));

describe('DiscoveryService AI limits', () => {
  it('propagates a token-limit 429 instead of returning a rules fallback', async () => {
    const profile = {
      requireComplete: jest.fn().mockResolvedValue({
        experienceLevel: 'BEGINNER',
        languages: ['TypeScript'],
        skills: [],
        description: null,
      }),
    };
    const github = {
      searchIssues: jest.fn().mockResolvedValue({
        items: candidates,
        total: 3,
        cached: false,
        stale: false,
        fetchedAt: new Date().toISOString(),
        rateLimitedUntil: null,
      }),
    };
    const aiUsage = {
      assertAllowed: jest
        .fn()
        .mockRejectedValue(new AppError('AI_TOKEN_LIMIT', 'Monthly limit reached', 429)),
    };
    const service = new DiscoveryService(
      {} as never,
      profile as never,
      github as never,
      aiUsage as never,
      {} as never,
      { create: jest.fn() } as never,
    );
    await expect(
      service.recommend('u1', { language: 'TypeScript', label: 'good first issue' }, false),
    ).rejects.toMatchObject({ code: 'AI_TOKEN_LIMIT', status: 429 });
  });
});

describe('heuristicRank', () => {
  it('rewards issues whose text matches a user-written skill', () => {
    const withSkill = { ...candidates[0]!, id: 'test/repo#10', number: 10, title: 'Add Prisma migration guide' };
    const withoutSkill = { ...candidates[1]!, id: 'test/repo#11', number: 11, title: 'Update the logo' };
    const ranked = heuristicRank([withoutSkill, withSkill], {
      experienceLevel: 'BEGINNER',
      languages: ['TypeScript'],
      skills: ['Prisma'],
    });
    expect(ranked[0]?.id).toBe(withSkill.id);
  });

  it('keeps language and level scoring intact', () => {
    const typed = { ...candidates[0]!, id: 'test/repo#12', number: 12, language: 'TypeScript' };
    const other = { ...candidates[1]!, id: 'test/repo#13', number: 13, language: 'Python' };
    const ranked = heuristicRank([other, typed], {
      experienceLevel: 'BEGINNER',
      languages: ['TypeScript'],
      skills: [],
    });
    expect(ranked[0]?.id).toBe(typed.id);
  });
});
