// src/utils/errors.ts
var ExitCode = /* @__PURE__ */ ((ExitCode2) => {
  ExitCode2[ExitCode2["Success"] = 0] = "Success";
  ExitCode2[ExitCode2["NotLoggedIn"] = 10] = "NotLoggedIn";
  ExitCode2[ExitCode2["MissingGithubToken"] = 11] = "MissingGithubToken";
  ExitCode2[ExitCode2["NotAGitRepo"] = 12] = "NotAGitRepo";
  ExitCode2[ExitCode2["GitFailed"] = 13] = "GitFailed";
  ExitCode2[ExitCode2["GithubApiError"] = 14] = "GithubApiError";
  ExitCode2[ExitCode2["ConfigMissing"] = 15] = "ConfigMissing";
  ExitCode2[ExitCode2["InvalidArgs"] = 16] = "InvalidArgs";
  ExitCode2[ExitCode2["GoogleSsoFailed"] = 17] = "GoogleSsoFailed";
  ExitCode2[ExitCode2["SessionExpired"] = 18] = "SessionExpired";
  ExitCode2[ExitCode2["NetworkError"] = 19] = "NetworkError";
  ExitCode2[ExitCode2["Unauthorized"] = 20] = "Unauthorized";
  return ExitCode2;
})(ExitCode || {});
var CliError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
};

// src/utils/logger.ts
var levelToNum = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
function maskSecrets(input) {
  if (!input) return input;
  return input.replace(/gh[pous]_[A-Za-z0-9_]{10,}/g, "***").replace(/[A-Za-z0-9-_]{32,}/g, "***");
}
var Logger = class {
  constructor(level = process.env.LOG_LEVEL || "info") {
    this.level = level;
  }
  setLevel(level) {
    this.level = level;
  }
  log(level, message, meta) {
    if (levelToNum[level] < levelToNum[this.level]) return;
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    const base = `[${ts}] [${level.toUpperCase()}]`;
    const msg = maskSecrets(message);
    if (meta !== void 0) {
      const safeMeta = maskSecrets(JSON.stringify(meta, null, 2));
      console.log(`${base} ${msg}
${safeMeta}`);
    } else {
      console.log(`${base} ${msg}`);
    }
  }
  debug(msg, meta) {
    this.log("debug", msg, meta);
  }
  info(msg, meta) {
    this.log("info", msg, meta);
  }
  warn(msg, meta) {
    this.log("warn", msg, meta);
  }
  error(msg, meta) {
    this.log("error", msg, meta);
  }
};
var logger = new Logger();

// src/utils/storage.ts
import os from "os";
import path from "path";
import fs from "fs";
var APP_DIR_NAME = "agent-commits";
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function getProjectRoot() {
  let current = process.cwd();
  for (let i = 0; i < 100; i++) {
    const gitDir = path.join(current, ".git");
    if (fs.existsSync(gitDir)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
function baseDir(scope) {
  if (scope === "project") {
    const root = getProjectRoot();
    return root ? path.join(root, `.${APP_DIR_NAME}`) : path.join(process.cwd(), `.${APP_DIR_NAME}`);
  }
  const home = os.homedir();
  return path.join(home, `.${APP_DIR_NAME}`);
}
function readJson(file, scope) {
  const dir = baseDir(scope);
  const full = path.join(dir, file);
  try {
    if (!fs.existsSync(full)) return null;
    const raw = fs.readFileSync(full, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeJson(file, scope, data) {
  const dir = baseDir(scope);
  ensureDir(dir);
  const full = path.join(dir, file);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), { encoding: "utf8" });
}
var CONFIG_FILE = "config.json";
var STATE_FILE = "state.json";
var defaultConfig = {
  branchPrefix: "agent",
  commitPrefix: "agent"
};
function getConfig(scope = "project") {
  const cfg = readJson(CONFIG_FILE, scope) || {};
  return {
    branchPrefix: cfg.branchPrefix || defaultConfig.branchPrefix,
    commitPrefix: cfg.commitPrefix || defaultConfig.commitPrefix
  };
}
function setConfig(scope, cfg) {
  const prev = readJson(CONFIG_FILE, scope) || {};
  writeJson(CONFIG_FILE, scope, { ...prev, ...cfg });
}
function getState() {
  const st = readJson(STATE_FILE, "profile");
  return st || {
    google: null,
    github: {}
  };
}
function setState(state) {
  writeJson(STATE_FILE, "profile", state);
}

export {
  ExitCode,
  CliError,
  Logger,
  logger,
  readJson,
  writeJson,
  defaultConfig,
  getConfig,
  setConfig,
  getState,
  setState
};
//# sourceMappingURL=chunk-KB75NY6S.js.map