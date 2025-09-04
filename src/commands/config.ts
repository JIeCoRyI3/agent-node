import { logger } from '../utils/logger';
import { requireGoogle } from '../auth/google';
import { setConfig, getConfig } from '../utils/storage';

export interface ConfigOptions {
  branch?: string;
  commit?: string;
}

export async function runConfig(options: ConfigOptions): Promise<void> {
  // Enforce SSO before any command per requirements
  requireGoogle();
  const updates: any = {};
  if (options.branch) updates.branchPrefix = options.branch;
  if (options.commit) updates.commitPrefix = options.commit;
  if (Object.keys(updates).length === 0) {
    const cfg = getConfig('project');
    logger.info('Current config', cfg);
    return;
  }
  setConfig('project', updates);
  const after = getConfig('project');
  logger.info('Updated config', after);
}

