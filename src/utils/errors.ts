export type ErrorCode =
  | "INVALID_REQUEST"
  | "AI_ENGINE_CONNECTION_ERROR"
  | "AI_ENGINE_REQUEST_FAILED"
  | "AI_ENGINE_TIMEOUT"
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
