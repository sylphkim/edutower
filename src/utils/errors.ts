export type ErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_REQUEST"
  | "LLM_AUTH_FAILED"
  | "LLM_MODEL_ERROR"
  | "LLM_RATE_LIMITED"
  | "LLM_CONNECTION_ERROR"
  | "LLM_REQUEST_FAILED"
  | "LLM_TIMEOUT"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, statusCode = 500, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
