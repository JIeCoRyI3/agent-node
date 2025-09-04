"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  CliError: () => CliError,
  ExitCode: () => ExitCode,
  Logger: () => Logger,
  defaultConfig: () => defaultConfig,
  getConfig: () => getConfig,
  getState: () => getState,
  logger: () => logger,
  readJson: () => readJson,
  setConfig: () => setConfig,
  setState: () => setState,
  writeJson: () => writeJson
});
module.exports = __toCommonJS(src_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CliError,
  ExitCode,
  Logger,
  defaultConfig,
  getConfig,
  getState,
  logger,
  readJson,
  setConfig,
  setState,
  writeJson
});
//# sourceMappingURL=index.cjs.map