import { execSync } from 'node:child_process';
import { logger } from '../utils/logger';
import { CliError, ExitCode } from '../utils/errors';

function run(command: string, options: { cwd?: string; env?: NodeJS.ProcessEnv; sensitive?: boolean } = {}): string {
  try {
    if (!options.sensitive) {
      logger.debug(`$ ${command}`);
    }
    const out = execSync(command, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
    });
    return out.trim();
  } catch (e: any) {
    throw new CliError(`Git command failed: ${command}\n${e?.stderr || e?.message || ''}`, ExitCode.GitFailed);
  }
}

export function ensureRepo(): void {
  try {
    run('git rev-parse --is-inside-work-tree');
  } catch (e) {
    throw new CliError('Not a git repository', ExitCode.NotAGitRepo);
  }
}

export function getRepoRoot(): string {
  return run('git rev-parse --show-toplevel');
}

export function getRepoAuthor(): string {
  return run('git config user.name');
}

export function getRepoName(): string {
  const root = getRepoRoot();
  return root.split(/[/\\]/).pop() as string;
}

export function getRemoteUrl(remote = 'origin'): string | null {
  try {
    return run(`git remote get-url ${remote}`);
  } catch {
    return null;
  }
}

export function createBranch(name: string): void {
  run(`git checkout -b ${name}`);
}

export function switchBranch(name: string): void {
  run(`git checkout ${name}`);
}

export function currentBranch(): string {
  return run('git rev-parse --abbrev-ref HEAD');
}

export function commitAll(message: string, authorName?: string, authorEmail?: string): void {
  run('git add -A');
  const env: NodeJS.ProcessEnv = {};
  if (authorName) {
    env.GIT_AUTHOR_NAME = authorName;
    env.GIT_COMMITTER_NAME = authorName;
  }
  if (authorEmail) {
    env.GIT_AUTHOR_EMAIL = authorEmail;
    env.GIT_COMMITTER_EMAIL = authorEmail;
  }
  run(`git commit --allow-empty -m "${message.replace(/"/g, '\\"')}"`, { env });
}

export function setRemote(name: string, url: string): void {
  const existing = getRemoteUrl(name);
  if (existing) {
    run(`git remote set-url ${name} ${url}`);
  } else {
    run(`git remote add ${name} ${url}`);
  }
}

export function push(remote = 'origin', branch?: string): void {
  const b = branch || currentBranch();
  run(`git push -u ${remote} ${b}`);
}

export function getUserEmail(): string {
  try {
    return run('git config user.email');
  } catch {
    return '';
  }
}

export function getUserName(): string {
  try {
    return run('git config user.name');
  } catch {
    return '';
  }
}

export function pushAllToUrlWithToken(url: string, token: string): void {
  const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
  const env = { GIT_HTTP_EXTRAHEADER: `Authorization: Basic ${basic}` } as NodeJS.ProcessEnv;
  run(`git push --all ${url}`, { env, sensitive: true });
  run(`git push --tags ${url}`, { env, sensitive: true });
}

