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

export interface AiEngineQuizParams {
  knowledgeTitle: string;
  knowledgeDescription?: string;
  difficulty: "pass" | "high_score";
  count: number;
}

export interface AiEngineSummaryParams {
  project: { title: string; subject: string; goal: string };
  localDate: string;
  studyData: string;
  conversationDigest?: string | null;
}

type RecordLike = Record<string, unknown>;

export class AiEngineService {
  /**
   * 聊天：仅转发给 FastAPI AI Engine 的 /chat。
   * Express 不直连 LLM；不可达时返回友好提示。
   */
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

      if (response.ok && isRecordLike(data) && typeof data.reply === "string") {
        return { reply: data.reply.trim() };
      }

      logger.warn("AI engine returned non-ok response.", {
        status: response.status,
        baseURL: env.aiEngineBaseUrl
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof Error
            ? error.message
            : String(error);

      logger.warn(`AI engine unreachable (${reason}).`, {
        baseURL: env.aiEngineBaseUrl
      });
    } finally {
      clearTimeout(timeout);
    }

    return { reply: this.unavailableChatReply(message) };
  }

  /**
   * 出题：仅转发给 FastAPI AI Engine 的 /generate-quiz。
   * 失败由上层 quizGenerator 退回 mock。
   */
  async generateQuiz(params: AiEngineQuizParams): Promise<unknown[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.aiEngineTimeoutMs);

    try {
      const response = await fetch(this.generateQuizUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          knowledge_title: params.knowledgeTitle,
          knowledge_description: params.knowledgeDescription,
          difficulty: params.difficulty,
          count: params.count
        }),
        signal: controller.signal
      });

      const data = await this.readJson(response);

      if (
        response.ok &&
        isRecordLike(data) &&
        Array.isArray((data as { questions?: unknown }).questions)
      ) {
        return (data as { questions: unknown[] }).questions;
      }

      throw new AppError("AI_ENGINE_REQUEST_FAILED", "AI engine 出题返回异常。", 502);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof Error
            ? error.message
            : String(error);

      throw new AppError(
        "AI_ENGINE_CONNECTION_ERROR",
        `AI engine 出题不可达 (${reason})。`,
        502,
        error
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 出总结：仅转发给 FastAPI /generate-summary。
   * 失败返回 null，由上层退回确定性模板。
   */
  async generateSummary(params: AiEngineSummaryParams): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.aiEngineTimeoutMs);

    try {
      const response = await fetch(this.generateSummaryUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project: {
            title: params.project.title,
            subject: params.project.subject,
            goal: params.project.goal
          },
          date: params.localDate,
          study_data: params.studyData,
          conversation_excerpts: params.conversationDigest ?? ""
        }),
        signal: controller.signal
      });

      const data = await this.readJson(response);

      if (
        response.ok &&
        isRecordLike(data) &&
        typeof data.summary === "string" &&
        data.summary.trim()
      ) {
        return data.summary.trim();
      }

      logger.warn("AI engine summary returned non-ok response.", {
        status: response.status,
        baseURL: env.aiEngineBaseUrl
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof Error
            ? error.message
            : String(error);

      logger.warn(`AI engine summary unreachable (${reason}).`, {
        baseURL: env.aiEngineBaseUrl
      });
    } finally {
      clearTimeout(timeout);
    }

    return null;
  }

  private unavailableChatReply(message: string): string {
    return (
      "AI 引擎暂时不可用，Express 不会直连大模型。\n\n" +
      "请确认：\n" +
      "1. FastAPI AI Engine（默认 http://127.0.0.1:8000）已启动\n" +
      "2. 已在设置页保存 LLM 配置（写入 .env）\n" +
      "3. 保存后已重启 FastAPI，使新配置生效\n\n" +
      `你刚才说：「${message}」`
    );
  }

  private chatUrl(): string {
    return new URL("/chat", env.aiEngineBaseUrl).toString();
  }

  private generateQuizUrl(): string {
    return new URL("/generate-quiz", env.aiEngineBaseUrl).toString();
  }

  private generateSummaryUrl(): string {
    return new URL("/generate-summary", env.aiEngineBaseUrl).toString();
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
