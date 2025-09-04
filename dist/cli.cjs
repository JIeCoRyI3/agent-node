"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cli.ts
var import_commander = require("commander");

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

// src/utils/errors.ts
var CliError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
};

// src/auth/google.ts
var import_node_child_process = require("child_process");

// src/utils/storage.ts
var import_node_os = __toESM(require("os"), 1);
var import_node_path = __toESM(require("path"), 1);
var import_node_fs = __toESM(require("fs"), 1);
var APP_DIR_NAME = "agent-commits";
function ensureDir(dir) {
  if (!import_node_fs.default.existsSync(dir)) import_node_fs.default.mkdirSync(dir, { recursive: true });
}
function getProjectRoot() {
  let current = process.cwd();
  for (let i = 0; i < 100; i++) {
    const gitDir = import_node_path.default.join(current, ".git");
    if (import_node_fs.default.existsSync(gitDir)) return current;
    const parent = import_node_path.default.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
function baseDir(scope) {
  if (scope === "project") {
    const root = getProjectRoot();
    return root ? import_node_path.default.join(root, `.${APP_DIR_NAME}`) : import_node_path.default.join(process.cwd(), `.${APP_DIR_NAME}`);
  }
  const home = import_node_os.default.homedir();
  return import_node_path.default.join(home, `.${APP_DIR_NAME}`);
}
function readJson(file, scope) {
  const dir = baseDir(scope);
  const full = import_node_path.default.join(dir, file);
  try {
    if (!import_node_fs.default.existsSync(full)) return null;
    const raw = import_node_fs.default.readFileSync(full, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeJson(file, scope, data) {
  const dir = baseDir(scope);
  ensureDir(dir);
  const full = import_node_path.default.join(dir, file);
  import_node_fs.default.writeFileSync(full, JSON.stringify(data, null, 2), { encoding: "utf8" });
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

// src/auth/google.ts
var GOOGLE_DEVICE_URL = "https://oauth2.googleapis.com/device/code";
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
var OAUTH_SCOPE = "openid email profile";
function getClientConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new CliError("Google OAuth client id is required in env GOOGLE_OAUTH_CLIENT_ID", 17 /* GoogleSsoFailed */);
  }
  return { clientId };
}
async function postForm(url, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error(`HTTP ${res.status} ${res.statusText}`);
    throw new CliError(`Request failed: ${res.status}`, 19 /* NetworkError */);
  }
  return res.json();
}
async function ensureGoogleLogin(nonInteractive = true) {
  const state = getState();
  const now = Date.now();
  if (state.google && state.google.expiresAt - 6e4 > now) {
    logger.debug("Google session is valid");
    return;
  }
  await deviceLogin(nonInteractive);
}
async function deviceLogin(nonInteractive = true) {
  const { clientId } = getClientConfig();
  logger.info("Starting Google SSO (device flow)");
  const init = await postForm(GOOGLE_DEVICE_URL, {
    client_id: clientId,
    scope: OAUTH_SCOPE
  });
  const verificationUrl = init.verification_url || init.verification_uri;
  const userCode = init.user_code;
  const deviceCode = init.device_code;
  const interval = (init.interval || 5) * 1e3;
  const expiresIn = init.expires_in * 1e3;
  logger.info(`Open URL to authorize: ${verificationUrl}`);
  logger.info(`User code: ${userCode}`);
  try {
    const cmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    (0, import_node_child_process.exec)(`${cmd} ${verificationUrl}`);
  } catch {
  }
  const startTime = Date.now();
  while (Date.now() - startTime < expiresIn) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const token = await postForm(GOOGLE_TOKEN_URL, {
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      });
      if (token.access_token) {
        const profileRes = await fetch(GOOGLE_USERINFO, {
          headers: { Authorization: `Bearer ${token.access_token}` }
        });
        const profile = await profileRes.json();
        const state = getState();
        state.google = {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: Date.now() + token.expires_in * 1e3,
          email: profile.email,
          sub: profile.sub
        };
        setState(state);
        logger.info("Google SSO success");
        return;
      }
    } catch (e) {
      if (e?.code === 19 /* NetworkError */) throw e;
    }
  }
  throw new CliError("Google SSO timed out", 17 /* GoogleSsoFailed */);
}
function requireGoogle() {
  const st = getState();
  if (!st.google || st.google.expiresAt <= Date.now()) {
    throw new CliError(
      "Google SSO required. Run: agent-commits login",
      10 /* NotLoggedIn */
    );
  }
}

// src/commands/login.ts
async function runLogin() {
  await ensureGoogleLogin(true);
  logger.info("Logged in with Google SSO.");
}

// src/git/index.ts
var import_node_child_process2 = require("child_process");
function run(command, options = {}) {
  try {
    if (!options.sensitive) {
      logger.debug(`$ ${command}`);
    }
    const out = (0, import_node_child_process2.execSync)(command, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      cwd: options.cwd,
      env: { ...process.env, ...options.env || {} }
    });
    return out.trim();
  } catch (e) {
    throw new CliError(`Git command failed: ${command}
${e?.stderr || e?.message || ""}`, 13 /* GitFailed */);
  }
}
function ensureRepo() {
  try {
    run("git rev-parse --is-inside-work-tree");
  } catch (e) {
    throw new CliError("Not a git repository", 12 /* NotAGitRepo */);
  }
}
function getRepoRoot() {
  return run("git rev-parse --show-toplevel");
}
function getRepoAuthor() {
  return run("git config user.name");
}
function getRepoName() {
  const root = getRepoRoot();
  return root.split(/[/\\]/).pop();
}
function getRemoteUrl(remote = "origin") {
  try {
    return run(`git remote get-url ${remote}`);
  } catch {
    return null;
  }
}
function createBranch(name) {
  run(`git checkout -b ${name}`);
}
function switchBranch(name) {
  run(`git checkout ${name}`);
}
function currentBranch() {
  return run("git rev-parse --abbrev-ref HEAD");
}
function commitAll(message, authorName, authorEmail) {
  run("git add -A");
  const env = {};
  if (authorName) {
    env.GIT_AUTHOR_NAME = authorName;
    env.GIT_COMMITTER_NAME = authorName;
  }
  if (authorEmail) {
    env.GIT_AUTHOR_EMAIL = authorEmail;
    env.GIT_COMMITTER_EMAIL = authorEmail;
  }
  run(`git commit --allow-empty -m "${message.replace(/"/g, '\\"')}"`, { env });
}
function getUserEmail() {
  try {
    return run("git config user.email");
  } catch {
    return "";
  }
}
function pushAllToUrlWithToken(url, token) {
  const basic = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
  const env = { GIT_HTTP_EXTRAHEADER: `Authorization: Basic ${basic}` };
  run(`git push --all ${url}`, { env, sensitive: true });
  run(`git push --tags ${url}`, { env, sensitive: true });
}

// src/github/api.ts
function getToken() {
  const env = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const st = getState();
  const token = env || st.github.token;
  if (!token) throw new CliError("GitHub token is required. Set GITHUB_TOKEN or run config.", 11 /* MissingGithubToken */);
  return token;
}
async function getAuthenticatedUser() {
  const token = getToken();
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `token ${token}`,
      "User-Agent": "agent-commits-cli",
      Accept: "application/vnd.github+json"
    }
  });
  if (!res.ok) {
    throw new CliError("GitHub API auth failed", res.status === 401 ? 20 /* Unauthorized */ : 14 /* GithubApiError */);
  }
  const user = await res.json();
  const username = user.login;
  const state = getState();
  state.github.username = username;
  state.github.token = token;
  setState(state);
  return username;
}
async function createRepository({ org, name, description, private: isPrivate = false }) {
  const token = getToken();
  const res = await fetch(`https://api.github.com/orgs/${org}/repos`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "User-Agent": "agent-commits-cli",
      Accept: "application/vnd.github+json"
    },
    body: JSON.stringify({ name, description, private: isPrivate, has_issues: true, has_wiki: false })
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error("Failed to create repo", { status: res.status, text });
    throw new CliError("GitHub create repo failed", 14 /* GithubApiError */);
  }
  const repo = await res.json();
  return repo.clone_url;
}

// src/commands/init.ts
async function runInit(options) {
  requireGoogle();
  ensureRepo();
  const org = options.org;
  if (!org) throw new CliError("Missing --org", 16 /* InvalidArgs */);
  const author = getRepoAuthor();
  const repoName = getRepoName();
  const agentRepo = `agent-${author}-${repoName}`.replace(/[^A-Za-z0-9-_]/g, "-");
  logger.info(`Will create repository: ${org}/${agentRepo}`);
  const ghUser = await getAuthenticatedUser();
  logger.info(`Authenticated as GitHub user: ${ghUser}`);
  const cloneUrl = await createRepository({ org, name: agentRepo, description: `Agent mirror for ${repoName} by ${author}`, private: !!options.private });
  logger.info("Created repository", { cloneUrl });
  const upstream = getRemoteUrl("origin");
  if (!upstream) {
    logger.warn("No origin remote found. Skipping push to agent repo.");
    return;
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new CliError("GITHUB_TOKEN required to push", 11 /* MissingGithubToken */);
  logger.info("Pushing all branches and tags to agent repository...");
  const pushUrl = cloneUrl;
  pushAllToUrlWithToken(pushUrl, token);
  logger.info("Push completed");
}

// src/commands/start.ts
async function pollWorkflowEvent(org, repo, token, intervalMs) {
  const url = `https://api.github.com/repos/${org}/${repo}/actions/runs?per_page=1`;
  while (true) {
    const res = await fetch(url, { headers: { Authorization: `token ${token}`, "User-Agent": "agent-commits-cli" } });
    if (!res.ok) throw new CliError("GitHub API error while polling", 14 /* GithubApiError */);
    const data = await res.json();
    if (data.workflow_runs && data.workflow_runs.length) {
      const run2 = data.workflow_runs[0];
      if (run2.status === "completed") return run2;
    }
    logger.info("No completed runs yet; waiting...");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
async function runStart(options) {
  requireGoogle();
  ensureRepo();
  const cfg = getConfig("project");
  const pollIntervalSec = parseInt(options.pollInterval || "30", 10);
  if (!Number.isFinite(pollIntervalSec) || pollIntervalSec <= 0) {
    throw new CliError("Invalid --poll-interval", 16 /* InvalidArgs */);
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new CliError("GITHUB_TOKEN required for polling", 11 /* MissingGithubToken */);
  logger.info(`Polling GitHub Actions for ${options.org}/${options.repo} every ${pollIntervalSec}s`);
  const event = await pollWorkflowEvent(options.org, options.repo, token, pollIntervalSec * 1e3);
  logger.info("Received event", { id: event.id, status: event.status, conclusion: event.conclusion });
  const branchName = `${cfg.branchPrefix}/${String(event.id)}`;
  const commitMessage = `${cfg.commitPrefix}: sync from agent event ${event.id}`;
  const prevBranch = currentBranch();
  try {
    createBranch(branchName);
  } catch (e) {
    switchBranch(branchName);
  }
  const authorEmail = getUserEmail();
  const gitUserName = process.env.GIT_AUTHOR_NAME || process.env.GIT_COMMITTER_NAME || process.env.USER || process.env.USERNAME || "user";
  commitAll(commitMessage, gitUserName, authorEmail);
  logger.info("Switched to branch and created commit", { branchName, commitMessage });
}

// src/commands/config.ts
async function runConfig(options) {
  requireGoogle();
  const updates = {};
  if (options.branch) updates.branchPrefix = options.branch;
  if (options.commit) updates.commitPrefix = options.commit;
  if (Object.keys(updates).length === 0) {
    const cfg = getConfig("project");
    logger.info("Current config", cfg);
    return;
  }
  setConfig("project", updates);
  const after = getConfig("project");
  logger.info("Updated config", after);
}

// src/cli.ts
var program = new import_commander.Command();
program.name("agent-commits").description("Reassign AI agent commits to current user with templates").version("0.1.1");
program.command("login").description("Perform Google SSO and store session locally").action(async () => {
  try {
    await runLogin();
    process.exit(0 /* Success */);
  } catch (e) {
    logger.error(e?.message || String(e));
    process.exit(e?.code || 1);
  }
});
program.command("init").description("Create agent-* GitHub repository copy using provided token").requiredOption("-o, --org <org>", "GitHub organization to create repository under").option("--private", "Create private repository", false).action(async (opts) => {
  try {
    await runInit(opts);
    process.exit(0 /* Success */);
  } catch (e) {
    logger.error(e?.message || String(e));
    process.exit(e?.code || 1);
  }
});
program.command("start").description("Wait for GitHub Actions event and create branch/commit with current user").requiredOption("-r, --repo <repo>", "agent-* repository name to listen for events").requiredOption("-o, --org <org>", "GitHub organization of agent repo").option("--poll-interval <seconds>", "Polling interval for events", "30").action(async (opts) => {
  try {
    await runStart(opts);
    process.exit(0 /* Success */);
  } catch (e) {
    logger.error(e?.message || String(e));
    process.exit(e?.code || 1);
  }
});
program.command("config").description("Configure branch and commit prefixes").option("--branch <prefix>", "Branch name prefix template").option("--commit <prefix>", "Commit message prefix template").action(async (opts) => {
  try {
    await runConfig(opts);
    process.exit(0 /* Success */);
  } catch (e) {
    logger.error(e?.message || String(e));
    process.exit(e?.code || 1);
  }
});
program.parseAsync(process.argv);
//# sourceMappingURL=cli.cjs.map