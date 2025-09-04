import { logger } from '../utils/logger';
import { CliError, ExitCode } from '../utils/errors';
import { getState, setState } from '../utils/storage';

export interface GithubContext {
  token: string;
  username: string;
  org?: string; // optional org to create repos under
}

function getToken(): string {
  const env = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const st = getState();
  const token = env || st.github.token;
  if (!token) throw new CliError('GitHub token is required. Set GITHUB_TOKEN or run config.', ExitCode.MissingGithubToken);
  return token;
}

export async function getAuthenticatedUser(): Promise<string> {
  const token = getToken();
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'agent-commits-cli',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new CliError('GitHub API auth failed', res.status === 401 ? ExitCode.Unauthorized : ExitCode.GithubApiError);
  }
  const user = await res.json();
  const username = user.login as string;
  const state = getState();
  state.github.username = username;
  state.github.token = token; // stored locally
  setState(state);
  return username;
}

export interface CreateRepoParams {
  org: string;
  name: string;
  description?: string;
  private?: boolean;
}

export async function createRepository({ org, name, description, private: isPrivate = false }: CreateRepoParams): Promise<string> {
  const token = getToken();
  const res = await fetch(`https://api.github.com/orgs/${org}/repos`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'agent-commits-cli',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ name, description, private: isPrivate, has_issues: true, has_wiki: false }),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error('Failed to create repo', { status: res.status, text });
    throw new CliError('GitHub create repo failed', ExitCode.GithubApiError);
  }
  const repo = await res.json();
  return repo.clone_url as string;
}

export async function createRepoFromTemplate({ org, name, templateOwner, templateRepo }: { org: string; name: string; templateOwner: string; templateRepo: string; }): Promise<string> {
  const token = getToken();
  const res = await fetch(`https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'agent-commits-cli',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ owner: org, name, include_all_branches: false, private: false }),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error('Failed to generate repo from template', { status: res.status, text });
    throw new CliError('GitHub template generate failed', ExitCode.GithubApiError);
  }
  const repo = await res.json();
  return repo.clone_url as string;
}

