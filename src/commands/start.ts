import { requireGoogle } from '../auth/google';
import { logger } from '../utils/logger';
import { createBranch, commitAll, currentBranch, ensureRepo, getUserEmail, switchBranch } from '../git';
import { getConfig } from '../utils/storage';
import { CliError, ExitCode } from '../utils/errors';

export interface StartOptions {
  org: string;
  repo: string; // agent-* repo name
  pollInterval?: string; // seconds
}

async function pollWorkflowEvent(org: string, repo: string, token: string, intervalMs: number): Promise<any> {
  const url = `https://api.github.com/repos/${org}/${repo}/actions/runs?per_page=1`;
  while (true) {
    const res = await fetch(url, { headers: { Authorization: `token ${token}`, 'User-Agent': 'agent-commits-cli' } });
    if (!res.ok) throw new CliError('GitHub API error while polling', ExitCode.GithubApiError);
    const data = await res.json();
    if (data.workflow_runs && data.workflow_runs.length) {
      const run = data.workflow_runs[0];
      // Deterministic trigger: completed and with conclusion success
      if (run.status === 'completed') return run;
    }
    logger.info('No completed runs yet; waiting...');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function runStart(options: StartOptions): Promise<void> {
  requireGoogle();
  ensureRepo();
  const cfg = getConfig('project');
  const pollIntervalSec = parseInt(options.pollInterval || '30', 10);
  if (!Number.isFinite(pollIntervalSec) || pollIntervalSec <= 0) {
    throw new CliError('Invalid --poll-interval', ExitCode.InvalidArgs);
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new CliError('GITHUB_TOKEN required for polling', ExitCode.MissingGithubToken);

  logger.info(`Polling GitHub Actions for ${options.org}/${options.repo} every ${pollIntervalSec}s`);
  const event = await pollWorkflowEvent(options.org, options.repo, token, pollIntervalSec * 1000);
  logger.info('Received event', { id: event.id, status: event.status, conclusion: event.conclusion });

  const branchName = `${cfg.branchPrefix}/${String(event.id)}`;
  const commitMessage = `${cfg.commitPrefix}: sync from agent event ${event.id}`;

  const prevBranch = currentBranch();
  try {
    createBranch(branchName);
  } catch (e) {
    // If branch exists, switch to it
    switchBranch(branchName);
  }

  const authorEmail = getUserEmail();
  // Use git configured user for deterministic authorship
  const gitUserName = process.env.GIT_AUTHOR_NAME || process.env.GIT_COMMITTER_NAME || process.env.USER || process.env.USERNAME || 'user';
  commitAll(commitMessage, gitUserName, authorEmail);

  logger.info('Switched to branch and created commit', { branchName, commitMessage });
}

