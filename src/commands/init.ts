import { requireGoogle } from '../auth/google';
import { logger } from '../utils/logger';
import { ensureRepo, getRepoAuthor, getRepoName, getRemoteUrl, pushAllToUrlWithToken } from '../git';
import { getAuthenticatedUser, createRepository } from '../github/api';
import { CliError, ExitCode } from '../utils/errors';

export interface InitOptions {
  org: string;
  private?: boolean;
}

export async function runInit(options: InitOptions): Promise<void> {
  requireGoogle();
  ensureRepo();

  const org = options.org;
  if (!org) throw new CliError('Missing --org', ExitCode.InvalidArgs);

  const author = getRepoAuthor();
  const repoName = getRepoName();
  const agentRepo = `agent-${author}-${repoName}`.replace(/[^A-Za-z0-9-_]/g, '-');
  logger.info(`Will create repository: ${org}/${agentRepo}`);

  const ghUser = await getAuthenticatedUser();
  logger.info(`Authenticated as GitHub user: ${ghUser}`);

  const cloneUrl = await createRepository({ org, name: agentRepo, description: `Agent mirror for ${repoName} by ${author}`, private: !!options.private });
  logger.info('Created repository', { cloneUrl });

  const upstream = getRemoteUrl('origin');
  if (!upstream) {
    logger.warn('No origin remote found. Skipping push to agent repo.');
    return;
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new CliError('GITHUB_TOKEN required to push', ExitCode.MissingGithubToken);
  logger.info('Pushing all branches and tags to agent repository...');
  // Convert clone URL to https with token-less URL, we use header-based auth
  const pushUrl = cloneUrl;
  pushAllToUrlWithToken(pushUrl, token);
  logger.info('Push completed');
}

