import { Command } from 'commander';
import { logger } from './utils/logger';
import { ExitCode } from './utils/errors';
import { runLogin } from './commands/login';
import { runInit } from './commands/init';
import { runStart } from './commands/start';
import { runConfig } from './commands/config';

const program = new Command();

program
  .name('agent-commits')
  .description('Reassign AI agent commits to current user with templates')
  .version('0.1.0');

program
  .command('login')
  .description('Perform Google SSO and store session locally')
  .action(async () => {
    try {
      await runLogin();
      process.exit(ExitCode.Success);
    } catch (e: any) {
      logger.error(e?.message || String(e));
      process.exit(e?.code || 1);
    }
  });

program
  .command('init')
  .description('Create agent-* GitHub repository copy using provided token')
  .requiredOption('-o, --org <org>', 'GitHub organization to create repository under')
  .option('--private', 'Create private repository', false)
  .action(async (opts) => {
    try {
      await runInit(opts);
      process.exit(ExitCode.Success);
    } catch (e: any) {
      logger.error(e?.message || String(e));
      process.exit(e?.code || 1);
    }
  });

program
  .command('start')
  .description('Wait for GitHub Actions event and create branch/commit with current user')
  .requiredOption('-r, --repo <repo>', 'agent-* repository name to listen for events')
  .requiredOption('-o, --org <org>', 'GitHub organization of agent repo')
  .option('--poll-interval <seconds>', 'Polling interval for events', '30')
  .action(async (opts) => {
    try {
      await runStart(opts);
      process.exit(ExitCode.Success);
    } catch (e: any) {
      logger.error(e?.message || String(e));
      process.exit(e?.code || 1);
    }
  });

program
  .command('config')
  .description('Configure branch and commit prefixes')
  .option('--branch <prefix>', 'Branch name prefix template')
  .option('--commit <prefix>', 'Commit message prefix template')
  .action(async (opts) => {
    try {
      await runConfig(opts);
      process.exit(ExitCode.Success);
    } catch (e: any) {
      logger.error(e?.message || String(e));
      process.exit(e?.code || 1);
    }
  });

program.parseAsync(process.argv);

