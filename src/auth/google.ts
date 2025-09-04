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
}

function getClientConfig(): GoogleClientConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new CliError('Google OAuth client id is required in env GOOGLE_OAUTH_CLIENT_ID', ExitCode.GoogleSsoFailed);
  }
  return { clientId };
}

async function postForm(url: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error(`HTTP ${res.status} ${res.statusText}`);
    throw new CliError(`Request failed: ${res.status}`, ExitCode.NetworkError);
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
  const interval = (init.interval || 5) * 1000;
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
    await new Promise((r) => setTimeout(r, interval));
    try {
      const token = await postForm(GOOGLE_TOKEN_URL, {
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
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
    } catch (e: any) {
      // authorization_pending / slow_down -> continue
      if (e?.code === ExitCode.NetworkError) throw e;
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

