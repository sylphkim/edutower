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

  /**
   * 出题：转发给 FastAPI AI Engine 的 /generate-quiz。
   * 按架构要求只经 FastAPI，不走本地 LLM 降级；失败直接抛错，
   * 由上层 quizGenerator 退回 mock。返回原始题目数组，交由上层校验。
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
   * 出总结：优先转发给 FastAPI AI Engine 的 /generate-summary（仿照 chat：
   * 不可达 / 返回异常时回退本地 llmService）。两条路都拿不到文本时返回 null，
   * 由上层退回确定性模板。
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

      logger.warn("AI engine summary returned non-ok response, falling back to local LLM.", {
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

      logger.warn(`AI engine summary unreachable (${reason}), falling back to local LLM.`, {
        baseURL: env.aiEngineBaseUrl
      });
    } finally {
      clearTimeout(timeout);
    }

    return this.fallbackSummary(params);
  }

  // ── 降级逻辑：本地 LLM ──────────────────────────────────────

  private async fallbackChat(
    sessionId: string,
    message: string,
    context?: ChatContext
  ): Promise<AiEngineChatResult> {
    const systemPrompt = this.buildFallbackSystemPrompt(context);

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

  private async fallbackSummary(params: AiEngineSummaryParams): Promise<string | null> {
    if (!env.llmApiKey) {
      // 没有本地 LLM key：交给上层退回确定性模板。
      return null;
    }

    try {
      const result = await llmService.generateText({
        systemPrompt: [
          "你是一名学习助教，请根据学习数据为学生写一段当日学习总结。",
          "要求：3-5 句中文，先肯定完成情况，再指出问题，最后给出明天的建议。",
          "若提供了当日对话摘录，请结合学生实际问到的内容来写，使总结更具体。",
          "只输出总结正文，不要输出标题、列表符号或额外说明。"
        ].join("\n"),
        userPrompt: [
          `学习项目：${params.project.title}（学科：${params.project.subject}，目标：${
            params.project.goal || "未填写"
          }）`,
          "当日学习数据：",
          params.studyData,
          ...(params.conversationDigest
            ? ["", "今日学习对话摘录（学生与助教）：", params.conversationDigest]
            : [])
        ].join("\n"),
        temperature: 0.4,
        maxOutputTokens: 600
      });
      const text = result.text.trim();

      return text ? text.slice(0, 2000) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Daily summary local LLM fallback failed (${message}); using template.`);
      return null;
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

      if (context.memories && context.memories.length > 0) {
        lines.push("## 长期记忆");
        for (const mem of context.memories) {
          lines.push(`- [${mem.type}] ${mem.title}：${mem.content}`);
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

    lines.push("");
    lines.push("## 记忆更新指令");
    lines.push("当你在对话中发现需要记录的重要信息时（如学生的新薄弱点、偏好、学习进步等），");
    lines.push("可以在回复末尾附加 memory_updates 块，格式如下：");
    lines.push("");
    lines.push("---memory_updates");
    lines.push('[{"type": "weakness", "title": "标题", "content": "详细描述", "importance": "medium"}]');
    lines.push("---");
    lines.push("");
    lines.push("支持的 type: weakness, daily_summary, progress, preference, note");
    lines.push("importance: low, medium, high（默认 medium）");
    lines.push("一次可以提交多条记忆，用 JSON 数组格式。");
    lines.push("只在确实需要记录的信息时才使用，不要每个回复都附加。");
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
