import { prerequisitesFor } from './prerequisites';

const base = { repoFullName: 'psf/requests', language: 'Python', labels: [] as string[] };

describe('prerequisitesFor', () => {
  it('uses the repository language instead of a fixed Node.js runtime', () => {
    const items = prerequisitesFor(base, 'main');
    expect(items.join(' ')).toMatch(/Python 3\.10\+/);
    expect(items.join(' ')).not.toMatch(/Node\.js/);
  });

  it('names the repository and the default branch', () => {
    const items = prerequisitesFor(base, 'trunk');
    expect(items[0]).toContain('psf/requests');
    expect(items[2]).toContain('trunk');
  });

  it('asks for the docs toolchain when the issue is documentation only', () => {
    const items = prerequisitesFor({ ...base, labels: ['documentation'] }, 'main');
    expect(items[1]).toMatch(/documentation build command/i);
  });

  it('keeps the code runtime when a docs issue also carries a code label', () => {
    const items = prerequisitesFor({ ...base, labels: ['documentation', 'bug'] }, 'main');
    expect(items[1]).toMatch(/Python/);
  });

  it('falls back to the README when the language is unknown', () => {
    const items = prerequisitesFor({ ...base, language: null }, 'main');
    expect(items[1]).toMatch(/toolchain named in the psf\/requests README/);
  });
});
