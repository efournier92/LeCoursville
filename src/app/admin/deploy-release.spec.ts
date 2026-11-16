import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEPLOY = join(process.cwd(), 'scripts', 'deploy.sh');

function sh(script: string, cwd: string, env: Record<string, string> = {}): string {
  return execFileSync('bash', ['-c', script], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lc-deploy-'));
  sh('git init -q && git config user.email e2e@test.local && git config user.name E2E', dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'lc', version: '1.0.0' }, null, 2));
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({
    name: 'lc', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'lc', version: '1.0.0' } },
  }, null, 2));
  sh('git add package.json package-lock.json && git commit -qm initial', dir);
  return dir;
}

function todayVersion(): string {
  const now = new Date();
  return `${String(now.getFullYear()).slice(-2)}.${now.getMonth() + 1}.${now.getDate()}`;
}

describe('deploy release versioning', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeRepo();
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('set_release_version bumps package.json to the no-leading-zero date token', () => {
    sh(`source "${DEPLOY}"; set_release_version`, repo, { REPO_ROOT: repo });
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    expect(pkg.version).toBe(todayVersion());
    expect(pkg.version).not.toMatch(/(^|\.)0\d/);
  });

  it('commit_release_version commits the bump so the tree is clean for the tag', () => {
    sh(`source "${DEPLOY}"; set_release_version; commit_release_version`, repo, { REPO_ROOT: repo });
    expect(sh('git status --porcelain', repo).trim()).toBe('');
    const committed = JSON.parse(sh('git show HEAD:package.json', repo));
    expect(committed.version).toBe(todayVersion());
    expect(sh('git log -1 --format=%s', repo).trim()).toBe(`Release ${todayVersion()}`);
  });

  it('tag_build skips an existing local and remote tag on a second same-day run', () => {
    const remote = join(repo, '..', `${repo.split('/').pop()}-remote.git`);
    sh(`git init -q --bare "${remote}"`, repo);
    sh(`git remote add origin "${remote}"`, repo);
    try {
      sh(`source "${DEPLOY}"; VERSION=26.11.8 tag_build`, repo, { REPO_ROOT: repo });
      const first = sh('git tag --list 26.11.8', repo).trim();
      expect(first).toBe('26.11.8');
      // A second run must not abort on the already-created tag.
      expect(() => sh(`source "${DEPLOY}"; VERSION=26.11.8 tag_build`, repo, { REPO_ROOT: repo })).not.toThrow();
      expect(sh('git ls-remote --tags origin refs/tags/26.11.8', repo)).toContain('26.11.8');
    } finally {
      rmSync(remote, { recursive: true, force: true });
    }
  });
});
