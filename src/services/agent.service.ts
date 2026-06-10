import type { Material } from "../types/material";
import type { Plan } from "../types/plan";
import type { QuizResult } from "../types/quizResult";
import type { Skill } from "../types/skill";
import type { WrongBookRecord } from "../types/wrongbook";
import { aiEngineService, type AiEngineChatParams } from "./aiEngine.service";

// ── Agent 对话 ────────────────────────────────────────

export interface AgentChatRequest {
  message: string;
  sessionId: string;
  context?: AgentContext;
}

export interface AgentContext {
  plan?: Plan;
  skills?: Skill[];
  materials?: Material[];
  recentQuizResults?: QuizResult[];
  wrongbookRecords?: WrongBookRecord[];
}

export class AgentService {
  async agentChat(req: AgentChatRequest): Promise<string> {
    const { message, sessionId, context } = req;
    const systemPrompt = this.buildSystemPrompt(context);

    const chatParams: AiEngineChatParams = {
      sessionId,
      message,
      context: {
        systemPrompt,
        subject: { id: "", name: "", gradeLevel: "", learningGoal: "" },
        materials: [],
        knowledgePoints: [],
        weakPoints: [],
        history: [],
      },
    };

    const result = await aiEngineService.chat(chatParams);
    return result.reply;
  }

  private buildSystemPrompt(context?: AgentContext): string {
    const parts: string[] = [
      "你是一位AI学习助手，帮助学生规划学习、解答问题、分析错题。",
      "请根据下方提供的上下文信息，结合学生的问题给出具体、有帮助的回答。",
    ];

    if (!context) return parts.join("\n");

    if (context.plan) {
      parts.push("\n【当前学习计划】\n" + JSON.stringify(context.plan, null, 2));
    }

    if (context.skills && context.skills.length > 0) {
      parts.push("\n【相关技能】\n" + JSON.stringify(context.skills, null, 2));
    }

    if (context.materials && context.materials.length > 0) {
      parts.push("\n【推荐资料】\n" + JSON.stringify(context.materials, null, 2));
    }

    if (context.recentQuizResults && context.recentQuizResults.length > 0) {
      parts.push("\n【近期测验结果】\n" + JSON.stringify(context.recentQuizResults, null, 2));
    }

    if (context.wrongbookRecords && context.wrongbookRecords.length > 0) {
      parts.push("\n【错题本记录】\n" + JSON.stringify(context.wrongbookRecords, null, 2));
    }

    return parts.join("\n");
  }
}

export const agentService = new AgentService();
