import { describe, expect, it } from 'vitest';
import {
  CV_MAX_BYTES,
  DiscoveryQuerySchema,
  IssueContextSchema,
  RecommendationResponseSchema,
  UpdateAiSettingsSchema,
  UpdateProfileSchema,
} from './index.js';

describe('contracts', () => {
  it('coerces discovery pagination and trims filters', () => {
    const parsed = DiscoveryQuerySchema.parse({ page: '2', perPage: '10', language: 'TypeScript' });
    expect(parsed.page).toBe(2);
    expect(parsed.language).toBe('TypeScript');
  });

  it('rejects an invalid repo filter', () => {
    expect(() => DiscoveryQuerySchema.parse({ repo: 'not-a-repo' })).toThrow();
  });

  it('caps profile languages and skills', () => {
    expect(() =>
      UpdateProfileSchema.parse({ languages: Array.from({ length: 9 }, (_, i) => `l${i}`) }),
    ).toThrow();
  });

  it('rejects an out-of-range temperature', () => {
    expect(() => UpdateAiSettingsSchema.parse({ temperature: 1.4 })).toThrow();
  });

  it('requires exactly three recommendations', () => {
    expect(() =>
      RecommendationResponseSchema.parse({
        batchId: 'b1',
        recommendations: [],
        fallback: false,
        fallbackReason: null,
        generatedAt: new Date().toISOString(),
        remainingTokens: 10,
      }),
    ).toThrow();
  });

  it('documents the CV limit as 5 MB', () => {
    expect(CV_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('IssueContextSchema', () => {
  const valid = {
    issue: {
      id: 'acme/widgets#42',
      number: 42,
      title: 'Add a migration guide',
      body: 'Steps to reproduce…',
      url: 'https://github.com/acme/widgets/issues/42',
      state: 'open',
      labels: ['good first issue'],
      author: 'octocat',
      assignee: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    comments: [],
    repo: {
      fullName: 'acme/widgets',
      url: 'https://github.com/acme/widgets',
      description: 'Widgets',
      defaultBranch: 'main',
      stars: 10,
      forks: 2,
      openIssues: 3,
      topics: ['typescript'],
      language: 'TypeScript',
      languages: [{ name: 'TypeScript', percent: 92.5 }],
      license: 'MIT',
      homepage: null,
      cloneUrl: 'https://github.com/acme/widgets.git',
      sshUrl: 'git@github.com:acme/widgets.git',
      pushedAt: new Date().toISOString(),
      readmeUrl: 'https://github.com/acme/widgets#readme',
      contributingUrl: null,
    },
    readme: '# Widgets',
    contributing: '',
    files: ['package.json', 'pnpm-lock.yaml'],
    commands: [{ label: 'Clone the repository', command: 'git clone …' }],
    links: {
      repo: 'https://github.com/acme/widgets',
      issue: 'https://github.com/acme/widgets/issues/42',
      readme: 'https://github.com/acme/widgets#readme',
      contributing: null,
    },
  };

  it('accepts a complete deterministic context', () => {
    expect(IssueContextSchema.parse(valid).commands).toHaveLength(1);
  });

  it('rejects a context without commands', () => {
    expect(() => IssueContextSchema.parse({ ...valid, commands: [] })).toThrow();
  });
});
