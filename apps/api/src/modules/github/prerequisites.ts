/**
 * Prerequisites are derived from the issue and the repository it belongs to.
 * A Python issue must not tell the contributor to install Node.js, so the
 * runtime comes from the repository language and documentation-only issues get
 * the docs toolchain instead.
 */
const RUNTIME_BY_LANGUAGE: Record<string, string> = {
  Python: 'Python 3.10+ and pip (or the package manager the repository declares)',
  TypeScript: 'Node.js 20+ and the package manager declared in the repository',
  JavaScript: 'Node.js 20+ and npm',
  Go: 'Go 1.22+',
  Rust: 'Rust 1.75+ and cargo',
  Java: 'JDK 17+ and the build tool in the README (Maven or Gradle)',
  Kotlin: 'JDK 17+ and Gradle',
  'C#': '.NET 8 SDK',
  'C++': 'A C++17 compiler and CMake',
  C: 'A C compiler and make',
  Ruby: 'Ruby 3.2+ and Bundler',
  PHP: 'PHP 8.2+ and Composer',
  Swift: 'A Swift 5.9+ toolchain',
  Dart: 'The Dart or Flutter SDK named in the README',
  Shell: 'A POSIX shell and the tooling listed in the README',
};

export interface PrerequisiteSource {
  repoFullName: string;
  language: string | null;
  labels: string[];
}

const DOCS_LABEL = /^(docs?|documentation|documentation improvement)$/i;
const CODE_LABEL = /^(bug|enhancement|feature|refactor|performance|tests?)$/i;

export function prerequisitesFor(issue: PrerequisiteSource, defaultBranch: string): string[] {
  const docsOnly =
    issue.labels.some((label) => DOCS_LABEL.test(label.trim())) &&
    !issue.labels.some((label) => CODE_LABEL.test(label.trim()));
  const runtime = issue.language
    ? RUNTIME_BY_LANGUAGE[issue.language] ?? `The ${issue.language} toolchain named in the README`
    : `The toolchain named in the ${issue.repoFullName} README`;

  return [
    `A GitHub account and your own fork of ${issue.repoFullName}`,
    docsOnly
      ? 'A text editor and the documentation build command listed in the README'
      : runtime,
    `Read \`CONTRIBUTING.md\` on \`${defaultBranch}\` if the repository has one`,
    'Run the test or lint command from the README before you open the pull request',
  ];
}
