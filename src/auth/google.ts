import crypto from 'node:crypto';
import os from 'node:os';
import http from 'node:http';
import { exec as execChild } from 'node:child_process';
import { logger } from '../utils/logger';
import { CliError, ExitCode } from '../utils/errors';
import { getState, setState } from '../utils/storage';

// We implement OAuth 2.0 device authorization flow to avoid browser callbacks and native addons.
// This uses Google's OAuth 2.0 for TV and Limited-Input devices.

const GOOGLE_DEVICE_URL = 'https://oauth2.googleapis.com/device/code';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Scopes: minimal to get user email and profile.
const OAUTH_SCOPE = 'openid email profile';

export interface GoogleClientConfig {
  clientId: string; // Provided by user via env or config
  clientSecret?: string; // Optional, required for confidential clients
}

function getClientConfig(): GoogleClientConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId) {
    throw new CliError('Google OAuth client id is required in env GOOGLE_OAUTH_CLIENT_ID', ExitCode.GoogleSsoFailed);
  }
  return { clientId, clientSecret };
}

async function postForm(url: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    let errBody: any = undefined;
    try {
      errBody = await res.json();
    } catch {}
    const errCode = errBody?.error;
    // For device endpoints we may get 400s for pending/slowdown. Let caller decide.
    if (errCode === 'authorization_pending' || errCode === 'slow_down') {
      const error = new Error(errCode) as any;
      (error as any).oauthError = errCode;
      throw error;
    }
    if (errCode === 'invalid_request' && /client_secret/i.test(errBody?.error_description || '')) {
      throw new CliError(
        'Google OAuth client secret required. Set GOOGLE_OAUTH_CLIENT_SECRET for confidential clients.',
        ExitCode.GoogleSsoFailed,
      );
    }
    const text = errBody ? JSON.stringify(errBody) : await res.text();
    logger.error(`HTTP ${res.status} ${res.statusText}`);
    throw new CliError(`Request failed: ${res.status} ${text}`, ExitCode.NetworkError);
  }
  return res.json();
}

export async function ensureGoogleLogin(nonInteractive = true): Promise<void> {
  const state = getState();
  const now = Date.now();
  if (state.google && state.google.expiresAt - 60_000 > now) {
    logger.debug('Google session is valid');
    return;
  }
  // No refresh token in device flow by default (unless configured). We perform device login again.
  await deviceLogin(nonInteractive);
}

export async function deviceLogin(nonInteractive = true): Promise<void> {
  const { clientId } = getClientConfig();
  logger.info('Starting Google SSO (device flow)');
  const init = await postForm(GOOGLE_DEVICE_URL, {
    client_id: clientId,
    scope: OAUTH_SCOPE,
  });

  const verificationUrl = init.verification_url || init.verification_uri;
  const userCode = init.user_code;
  const deviceCode = init.device_code;
  let pollInterval = (init.interval || 5) * 1000;
  const expiresIn = init.expires_in * 1000;

  logger.info(`Open URL to authorize: ${verificationUrl}`);
  logger.info(`User code: ${userCode}`);

  // Attempt to open default browser non-blocking; ignore failures
  try {
    const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    execChild(`${cmd} ${verificationUrl}`);
  } catch {}

  const startTime = Date.now();
  while (Date.now() - startTime < expiresIn) {
    await new Promise((r) => setTimeout(r, pollInterval));
    try {
      const { clientSecret } = getClientConfig();
      const body = new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        ...(clientSecret ? { client_secret: clientSecret } : {}),
      }).toString();
      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (res.ok) {
        const token = await res.json();
        if (token.access_token) {
          const profileRes = await fetch(GOOGLE_USERINFO, {
            headers: { Authorization: `Bearer ${token.access_token}` },
          });
          const profile = await profileRes.json();
          const state = getState();
          state.google = {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: Date.now() + token.expires_in * 1000,
            email: profile.email,
            sub: profile.sub,
          };
          setState(state);
          logger.info('Google SSO success');
          return;
        }
      } else {
        let errBody: any = undefined;
        try {
          errBody = await res.json();
        } catch {}
        const errCode = errBody?.error;
        if (errCode === 'authorization_pending') {
          // Continue polling
          continue;
        }
        if (errCode === 'slow_down') {
          // Increase polling interval by 5 seconds as per spec
          pollInterval += 5_000;
          continue;
        }
        if (errCode === 'access_denied') {
          throw new CliError('Google SSO was denied by user', ExitCode.GoogleSsoFailed);
        }
        if (errCode === 'expired_token' || errCode === 'invalid_grant') {
          throw new CliError('Google SSO device code expired or invalid', ExitCode.GoogleSsoFailed);
        }
        if (errCode === 'invalid_request' && /client_secret/i.test(errBody?.error_description || '')) {
          throw new CliError(
            'Google OAuth client secret required. Set GOOGLE_OAUTH_CLIENT_SECRET for confidential clients.',
            ExitCode.GoogleSsoFailed,
          );
        }

        const text = errBody ? JSON.stringify(errBody) : await res.text();
        logger.error(`HTTP ${res.status} ${res.statusText}`);
        throw new CliError(`Request failed: ${res.status} ${text}`, ExitCode.NetworkError);
      }
    } catch (e: any) {
      // Network errors should bubble up; others are handled above
      if (e?.code === ExitCode.NetworkError || e?.code === ExitCode.GoogleSsoFailed) throw e;
    }
  }
  throw new CliError('Google SSO timed out', ExitCode.GoogleSsoFailed);
}

export function requireGoogle(): void {
  const st = getState();
  if (!st.google || st.google.expiresAt <= Date.now()) {
    throw new CliError(
      'Google SSO required. Run: agent-commits login',
      ExitCode.NotLoggedIn,
    );
  }
}

export function getGoogleAccessToken(): string {
  const st = getState();
  if (!st.google || st.google.expiresAt <= Date.now()) {
    throw new CliError('Google session expired', ExitCode.SessionExpired);
  }
  return st.google.accessToken;
}

