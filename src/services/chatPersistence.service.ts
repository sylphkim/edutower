import { conversationsRepository } from "../repositories/conversations.repository";
import { logger } from "../utils/logger";
import { getDemoUserId } from "./demoUser.service";

export interface SaveChatExchangeParams {
  sessionId: string;
  conversationId?: string;
  projectId?: string;
  userMessage: string;
  aiReply: string;
  engine: string;
}

export const chatPersistenceService = {
  async saveChatExchange(params: SaveChatExchangeParams): Promise<void> {
    // 没绑定子对话：保持与旧前端 / legacy /chat 兼容，不落库。
    if (!params.conversationId) {
      return;
    }

    try {
      const userId = await getDemoUserId();
      await conversationsRepository.appendExchangeForUser({
        conversationId: params.conversationId,
        userId,
        userMessage: params.userMessage,
        aiReply: params.aiReply
      });
    } catch (error) {
      // 持久化是尽力而为的副作用：失败只告警，不影响已经返回给用户的回复。
      logger.warn("Failed to persist chat exchange to conversation.", {
        conversationId: params.conversationId,
        error
      });
    }
  },

  async saveDailySummary(_params: {
    sessionId: string;
    projectId?: string;
    content: string;
    weaknesses?: string;
  }): Promise<void> {
    // TODO(第2步): 接通「今日战况」每日总结落库。
  },

  async saveMemory(_params: {
    sessionId: string;
    type: "weakness" | "progress" | "preference";
    title: string;
    content: string;
  }): Promise<void> {
    // TODO(第3步): Memory 迁到 Prisma 后在此落库。
  }
};
