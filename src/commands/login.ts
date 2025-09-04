import { ensureGoogleLogin } from '../auth/google';
import { logger } from '../utils/logger';

export async function runLogin(): Promise<void> {
  await ensureGoogleLogin(true);
  logger.info('Logged in with Google SSO.');
}

