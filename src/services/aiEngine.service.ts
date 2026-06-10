import { env } from "../config/env";
import type { ChatContext } from "../types/chatContext";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { llmService } from "./llm.service";

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

    // 1) 尝试连接 FastAPI AI Engine
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
        return { reply: data.reply };
      }

      logger.warn("AI engine returned non-ok response, falling back to local LLM.", {
        status: response.status,
        baseURL: env.aiEngineBaseUrl
      });
    } catch (error) {
      // FastAPI 不可达 → 降级到本地 LLM
      if (error instanceof AppError) {
        throw error;
      }

      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof Error
            ? error.message
            : String(error);

      logger.warn(
        `AI engine unreachable (${reason}), falling back to local LLM.`,
        { baseURL: env.aiEngineBaseUrl }
      );
    } finally {
      clearTimeout(timeout);
    }

    // 2) 降级：使用本地 llmService 直接调用 LLM
    return this.fallbackChat(sessionId, message, params.context);
  }

  // ── 降级逻辑：本地 LLM ──────────────────────────────────────

  private async fallbackChat(
    sessionId: string,
    message: string,
    context?: ChatContext
  ): Promise<AiEngineChatResult> {
    const systemPrompt = context?.systemPrompt || this.buildFallbackSystemPrompt(context);

    try {
      const result = await llmService.generateText({
        systemPrompt,
        userPrompt: message
      });

      return { reply: result.text };
    } catch (error) {
      if (error instanceof AppError) {
        // 如果是 LLM_API_KEY 未配置，给一个友好的降级回复
        if (error.code === "MISSING_API_KEY") {
          logger.warn("LLM_API_KEY not configured — returning mock reply.");
          return {
            reply: this.mockReply(message)
          };
        }
        throw error;
      }

      logger.error("Local LLM fallback failed.", error);
      throw new AppError(
        "AI_ENGINE_REQUEST_FAILED",
        "AI engine is unavailable and local LLM fallback also failed. Please try again later.",
        502,
        error
      );
    }
  }

  private buildFallbackSystemPrompt(context?: ChatContext): string {
    const lines = [
      "你是 EduTower AI 智能助教，一位专业的学习辅导老师。",
      "你的职责是帮助学生梳理知识点、讲解错题、解答疑问、推荐练习。",
      "请用中文（简体）回答。回答要简洁、准确、有鼓励性。",
      ""
    ];

    if (context) {
      if (context.subject) {
        lines.push(`## 当前学科`);
        lines.push(`- ${context.subject.name}（${context.subject.gradeLevel}）`);
        lines.push(`- 学习目标：${context.subject.learningGoal}`);
        lines.push("");
      }

      if (context.knowledgePoints && context.knowledgePoints.length > 0) {
        lines.push("## 学生知识点掌握情况");
        for (const kp of context.knowledgePoints) {
          lines.push(`- ${kp.title}：掌握度 ${Math.round(kp.mastery * 100)}%`);
        }
        lines.push("");
      }

      if (context.weakPoints && context.weakPoints.length > 0) {
        lines.push("## 薄弱环节（需要重点帮助）");
        for (const wp of context.weakPoints) {
          lines.push(`- ${wp.title}（${wp.reason}）→ 建议：${wp.suggestedAction}`);
        }
        lines.push("");
      }

      if (context.materials && context.materials.length > 0) {
        lines.push("## 学生的学习资料");
        for (const m of context.materials) {
          lines.push(`- 《${m.title}》：${m.summary}`);
        }
        lines.push("");
      }

      if (context.sessionHistory && context.sessionHistory.length > 0) {
        lines.push("## 最近对话记录");
        for (const h of context.sessionHistory.slice(-6)) {
          const roleLabel = h.role === "user" ? "学生" : "助教";
          lines.push(`- ${roleLabel}：${h.content}`);
        }
        lines.push("");
      }
    }

    lines.push("请根据以上信息，为学生提供有针对性的辅导。");
    return lines.join("\n");
  }

  private mockReply(message: string): string {
    return (
      "你好！我是 EduTower AI 助教（当前为离线演示模式）。\n\n" +
      `你刚才说：「${message}」\n\n` +
      "要启用完整的 AI 辅导功能，请配置 LLM_API_KEY 环境变量。\n" +
      "在 .env 文件中设置：\n" +
      "- LLM_API_KEY=你的API密钥\n" +
      "- LLM_BASE_URL=你的LLM地址\n" +
      "- LLM_MODEL=模型名称\n\n" +
      "当前 Express 后端已就绪，所有 API 端点均可正常访问。"
    );
  }

  // ── 工具方法 ──────────────────────────────────────────────

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
