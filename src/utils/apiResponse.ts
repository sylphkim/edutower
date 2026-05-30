import { Response } from "express";
import { ErrorCode } from "./errors";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function successResponse<T>(data: T): ApiSuccess<T> {
  return {
    ok: true,
    data
  };
}

export function errorResponse(code: ErrorCode, message: string): ApiFailure {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json(successResponse(data));
}

export function sendError(
  res: Response,
  statusCode: number,
  code: ErrorCode,
  message: string
): void {
  res.status(statusCode).json(errorResponse(code, message));
}
