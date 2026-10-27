import { buildStartCommands } from './start-commands';

describe('buildStartCommands', () => {
  it('builds the clone, branch and pnpm loop for a Node repository', () => {
    const commands = buildStartCommands({
      repoFullName: 'acme/widgets',
      cloneUrl: 'https://github.com/acme/widgets.git',
      defaultBranch: 'main',
      issueNumber: 42,
      files: ['package.json', 'pnpm-lock.yaml', 'src/index.ts'],
      scripts: { test: 'vitest run', dev: 'next dev' },
    });
    expect(commands.map((entry) => entry.command)).toEqual([
      'git clone https://github.com/acme/widgets.git',
      'cd widgets',
      'git checkout -b fix/issue-42',
      'pnpm install',
      'pnpm test',
    ]);
  });

  it('uses npm ci when the lockfile is package-lock.json', () => {
    const commands = buildStartCommands({
      repoFullName: 'acme/plain',
      cloneUrl: 'https://github.com/acme/plain.git',
      defaultBranch: 'main',
      issueNumber: 7,
      files: ['package.json', 'package-lock.json'],
      scripts: {},
    });
    expect(commands.map((entry) => entry.command)).toContain('npm ci');
    expect(commands.map((entry) => entry.command)).not.toContain('npm test');
  });

  it('sets up a Python virtualenv and pytest', () => {
    const commands = buildStartCommands({
      repoFullName: 'acme/py',
      cloneUrl: 'https://github.com/acme/py.git',
      defaultBranch: 'main',
      issueNumber: 3,
      files: ['requirements.txt', 'tests/test_app.py'],
      scripts: {},
    });
    const values = commands.map((entry) => entry.command);
    expect(values).toContain('python -m venv .venv');
    expect(values).toContain('pip install -r requirements.txt');
    expect(values).toContain('pytest');
  });

  it('stops at the branch when the repository has no manifest', () => {
    const commands = buildStartCommands({
      repoFullName: 'acme/docs',
      cloneUrl: 'https://github.com/acme/docs.git',
      defaultBranch: 'main',
      issueNumber: 1,
      files: ['README.md'],
      scripts: {},
    });
    expect(commands).toHaveLength(3);
  });
});
