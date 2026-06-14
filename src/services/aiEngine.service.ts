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

export interface AiEnginePlanParams {
  project: {
    title: string;
    subject: string;
    goal: string;
    targetScore: string | null;
    deadline: string | null;
    dailyMinutes: number | null;
  };
  materials: Array<{ title: string; summary: string }>;
  masteredConcepts: Array<{ name: string; subject: string | null }>;
}

/** FastAPI 返回的计划草稿（未校验）；交由 normalizePlanProposal 规整。 */
export interface AiEnginePlanDraft {
  nodes: unknown;
  prerequisiteEdges: unknown;
  phases: unknown;
}

type RecordLike = Record<string, unknown>;

export class AiEngineService {
  /**
   * 聊天：统一转发给 FastAPI AI Engine 的 /chat。
   * FastAPI 不可达 / 返回异常时返回友好降级文案——Express 绝不直连 LLM。
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

    // FastAPI 不可用：友好降级，不直连 LLM。
    return { reply: this.unavailableChatReply(message) };
  }

  /**
   * 出题：转发给 FastAPI AI Engine 的 /generate-quiz。
   * 只经 FastAPI；失败直接抛错，由上层 quizGenerator 退回 mock。
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
   * 出总结：转发给 FastAPI AI Engine 的 /generate-summary。
   * 不可达 / 返回异常时返回 null，由上层退回确定性模板——不直连 LLM。
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

      logger.warn("AI engine summary returned non-ok response, using template.", {
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

      logger.warn(`AI engine summary unreachable (${reason}), using template.`, {
        baseURL: env.aiEngineBaseUrl
      });
    } finally {
      clearTimeout(timeout);
    }

    // 拿不到 AI 文本：交给上层退回确定性模板。
    return null;
  }

  /**
   * 自由答疑小结：复用 FastAPI 的 /generate-summary（套一层「自由答疑」轻量上下文）。
   * 不可达 / 异常时返回 null，由上层退回确定性模板——同样不直连 LLM。
   */
  async summarizeFreeQa(conversationDigest: string): Promise<string | null> {
    return this.generateSummary({
      project: { title: "自由答疑", subject: "通用答疑", goal: "" },
      localDate: new Date().toISOString().slice(0, 10),
      studyData: "（自由答疑会话，无项目任务数据）",
      conversationDigest
    });
  }

  /**
   * 生成计划草稿：转发给 FastAPI AI Engine 的 /generate-plan。
   * 请求走 snake_case；响应须为 camelCase（直接喂给 normalizePlanProposal 校验）。
   * 不可达 / 返回异常时抛错——不假造学习计划，也不直连 LLM。
   */
  async generatePlan(params: AiEnginePlanParams): Promise<AiEnginePlanDraft> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.aiEngineTimeoutMs);

    try {
      const response = await fetch(this.generatePlanUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project: {
            title: params.project.title,
            subject: params.project.subject,
            goal: params.project.goal,
            target_score: params.project.targetScore,
            deadline: params.project.deadline,
            daily_minutes: params.project.dailyMinutes
          },
          materials: params.materials,
          mastered_concepts: params.masteredConcepts
        }),
        signal: controller.signal
      });

      const data = await this.readJson(response);

      if (response.ok && isRecordLike(data)) {
        const record = data as Record<string, unknown>;
        return {
          nodes: record.nodes,
          prerequisiteEdges: record.prerequisiteEdges ?? [],
          phases: record.phases
        };
      }

      throw new AppError("AI_ENGINE_REQUEST_FAILED", "AI engine 生成计划返回异常。", 502);
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
        `AI engine 生成计划不可达 (${reason})。`,
        502,
        error
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── FastAPI 不可用时的降级（不直连 LLM）──────────────────────

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

  private generatePlanUrl(): string {
    return new URL("/generate-plan", env.aiEngineBaseUrl).toString();
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
