import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

type Scope = 'project' | 'profile';

const APP_DIR_NAME = 'agent-commits';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getProjectRoot(): string | null {
  // Detect git repo root deterministically by walking up until .git or root
  let current = process.cwd();
  // Hard limit to avoid infinite loops
  for (let i = 0; i < 100; i++) {
    const gitDir = path.join(current, '.git');
    if (fs.existsSync(gitDir)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function baseDir(scope: Scope): string {
  if (scope === 'project') {
    const root = getProjectRoot();
    return root ? path.join(root, `.${APP_DIR_NAME}`) : path.join(process.cwd(), `.${APP_DIR_NAME}`);
  }
  const home = os.homedir();
  return path.join(home, `.${APP_DIR_NAME}`);
}

export function readJson<T>(file: string, scope: Scope): T | null {
  const dir = baseDir(scope);
  const full = path.join(dir, file);
  try {
    if (!fs.existsSync(full)) return null;
    const raw = fs.readFileSync(full, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson<T>(file: string, scope: Scope, data: T): void {
  const dir = baseDir(scope);
  ensureDir(dir);
  const full = path.join(dir, file);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

export interface AppConfig {
  branchPrefix?: string;
  commitPrefix?: string;
}

export interface SessionState {
  google: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number; // epoch ms
    email?: string;
    sub?: string;
  } | null;
  github: {
    token?: string; // not logged, masked
    username?: string;
  };
}

const CONFIG_FILE = 'config.json';
const STATE_FILE = 'state.json';

export const defaultConfig: Required<AppConfig> = {
  branchPrefix: 'agent',
  commitPrefix: 'agent',
};

export function getConfig(scope: Scope = 'project'): Required<AppConfig> {
  const cfg = readJson<AppConfig>(CONFIG_FILE, scope) || {};
  return {
    branchPrefix: cfg.branchPrefix || defaultConfig.branchPrefix,
    commitPrefix: cfg.commitPrefix || defaultConfig.commitPrefix,
  };
}

export function setConfig(scope: Scope, cfg: Partial<AppConfig>) {
  const prev = readJson<AppConfig>(CONFIG_FILE, scope) || {};
  writeJson(CONFIG_FILE, scope, { ...prev, ...cfg });
}

export function getState(): SessionState {
  const st = readJson<SessionState>(STATE_FILE, 'profile');
  return (
    st || {
      google: null,
      github: {},
    }
  );
}

export function setState(state: SessionState): void {
  writeJson(STATE_FILE, 'profile', state);
}

