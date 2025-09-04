/* Simple structured logger with levels and secret masking */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelToNum: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function maskSecrets(input: string): string {
  if (!input) return input;
  // Mask tokens/secrets-like substrings (40+ chars alnum or begins with ghp_)
  return input
    .replace(/gh[pous]_[A-Za-z0-9_]{10,}/g, '***')
    .replace(/[A-Za-z0-9-_]{32,}/g, '***');
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info') {
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private log(level: LogLevel, message: string, meta?: unknown) {
    if (levelToNum[level] < levelToNum[this.level]) return;
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level.toUpperCase()}]`;
    const msg = maskSecrets(message);
    if (meta !== undefined) {
      const safeMeta = maskSecrets(JSON.stringify(meta, null, 2));
      // eslint-disable-next-line no-console
      console.log(`${base} ${msg}\n${safeMeta}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`${base} ${msg}`);
    }
  }

  debug(msg: string, meta?: unknown) { this.log('debug', msg, meta); }
  info(msg: string, meta?: unknown) { this.log('info', msg, meta); }
  warn(msg: string, meta?: unknown) { this.log('warn', msg, meta); }
  error(msg: string, meta?: unknown) { this.log('error', msg, meta); }
}

export const logger = new Logger();

