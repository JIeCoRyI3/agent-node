export enum ExitCode {
  Success = 0,
  NotLoggedIn = 10,
  MissingGithubToken = 11,
  NotAGitRepo = 12,
  GitFailed = 13,
  GithubApiError = 14,
  ConfigMissing = 15,
  InvalidArgs = 16,
  GoogleSsoFailed = 17,
  SessionExpired = 18,
  NetworkError = 19,
  Unauthorized = 20,
}

export class CliError extends Error {
  code: ExitCode;
  constructor(message: string, code: ExitCode) {
    super(message);
    this.code = code;
  }
}

