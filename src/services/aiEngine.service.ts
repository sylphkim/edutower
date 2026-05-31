import { env } from "../config/env";
import type { ChatContext } from "../types/chatContext";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

export interface AiEngineChatParams {
  sessionId: string;
  message: string;
  context?: ChatContext;
}

export interface AiEngineChatResult {
  reply: string;
}

type RecordLike = Record<string, unknown>;

export class AiEngineService {
  async chat(params: AiEngineChatParams): Promise<AiEngineChatResult> {
    const sessionId = params.sessionId?.trim();
    const message = params.message?.trim();

    if (!sessionId) {
      throw new AppError("INVALID_REQUEST", "session_id is required.", 400);
    }

    if (!message) {
      throw new AppError("INVALID_REQUEST", "message is required.", 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.aiEngineTimeoutMs);

    try {
      const response = await fetch(this.chatUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: sessionId,
          message,
          context: params.context
        }),
        signal: controller.signal
      });

      const data = await this.readJson(response);

      if (!response.ok) {
        logger.error("AI engine request failed.", {
          baseURL: env.aiEngineBaseUrl,
          status: response.status,
          detail: isRecordLike(data) ? data.detail : undefined
        });

        throw new AppError(
          "AI_ENGINE_REQUEST_FAILED",
          "AI engine request failed. Please try again later.",
          502
        );
      }

      if (!isRecordLike(data) || typeof data.reply !== "string") {
        throw new AppError("AI_ENGINE_REQUEST_FAILED", "AI engine returned an invalid response.", 502);
      }

      return {
        reply: data.reply
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("AI_ENGINE_TIMEOUT", "AI engine request timed out.", 504, error);
      }

      logger.error("AI engine connection failed.", {
        baseURL: env.aiEngineBaseUrl,
        message: error instanceof Error ? error.message : String(error)
      });

      throw new AppError("AI_ENGINE_CONNECTION_ERROR", "Could not connect to AI engine.", 502, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private chatUrl(): string {
    return new URL("/chat", env.aiEngineBaseUrl).toString();
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}

function isRecordLike(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

export const aiEngineService = new AiEngineService();
