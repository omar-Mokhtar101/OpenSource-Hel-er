export interface StartCommandInput {
  repoFullName: string;
  cloneUrl: string;
  defaultBranch: string;
  issueNumber: number;
  files: string[];
  scripts: Record<string, string>;
}

export interface StartCommand {
  label: string;
  command: string;
}

/**
 * Deterministic "start from zero" commands derived from the repository files.
 * No AI: the same inputs always produce the same list.
 */
export function buildStartCommands(input: StartCommandInput): StartCommand[] {
  const repo = input.repoFullName.split('/')[1] ?? input.repoFullName;
  const files = new Set(input.files);
  const commands: StartCommand[] = [
    { label: 'Clone the repository', command: `git clone ${input.cloneUrl}` },
    { label: 'Enter the folder', command: `cd ${repo}` },
    { label: 'Create your branch', command: `git checkout -b fix/issue-${input.issueNumber}` },
  ];

  const add = (label: string, command: string) => commands.push({ label, command });

  if (files.has('pnpm-lock.yaml')) {
    add('Install dependencies', 'pnpm install');
    if (input.scripts.test) add('Run the tests', 'pnpm test');
    else add('Start the project', 'pnpm dev');
  } else if (files.has('yarn.lock')) {
    add('Install dependencies', 'yarn install');
    if (input.scripts.test) add('Run the tests', 'yarn test');
  } else if (files.has('package-lock.json') || files.has('package.json')) {
    add('Install dependencies', files.has('package-lock.json') ? 'npm ci' : 'npm install');
    if (input.scripts.test) add('Run the tests', 'npm test');
  } else if (files.has('requirements.txt') || files.has('pyproject.toml')) {
    add('Create a virtualenv', 'python -m venv .venv');
    add('Activate it', 'source .venv/bin/activate');
    if (files.has('requirements.txt')) add('Install dependencies', 'pip install -r requirements.txt');
    else add('Install the project', 'pip install -e .');
    if (
      [...files].some((file) => file.startsWith('tests/') || file === 'pytest.ini') ||
      files.has('pyproject.toml')
    ) {
      add('Run the tests', 'pytest');
    }
  } else if (files.has('go.mod')) {
    add('Download modules', 'go mod download');
    add('Run the tests', 'go test ./...');
  } else if (files.has('Cargo.toml')) {
    add('Build the project', 'cargo build');
    add('Run the tests', 'cargo test');
  }

  return commands;
}
