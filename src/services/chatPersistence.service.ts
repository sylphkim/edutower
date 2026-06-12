<<<<<<< HEAD
import { conversationsRepository } from "../repositories/conversations.repository";
import { logger } from "../utils/logger";
import { getDemoUserId } from "./demoUser.service";

export interface SaveChatExchangeParams {
  sessionId: string;
  conversationId?: string;
=======
import { prisma } from "../lib/prisma";
import { getDemoUserId } from "./demoUser.service";
import { memoryService } from "./memory.service";

export interface SaveChatExchangeParams {
  sessionId: string;
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
  projectId?: string;
  userMessage: string;
  aiReply: string;
  engine: string;
}

const DEFAULT_CONVERSATION_TITLE = "AI Chat";

export const chatPersistenceService = {
  async saveChatExchange(params: SaveChatExchangeParams): Promise<void> {
<<<<<<< HEAD
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
=======
    const userId = await getDemoUserId();

    // 查找已有 Conversation，没有则创建
    let conversation = await prisma.conversation.findFirst({
      where: { externalSessionId: params.sessionId }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          projectId: params.projectId,
          type: "free_qa",
          title: DEFAULT_CONVERSATION_TITLE,
          externalSessionId: params.sessionId
        }
      });
    }

    // 用户消息
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: params.userMessage
      }
    });

    // AI 回复
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: params.aiReply
      }
    });
  },

  async saveDailySummary(params: {
    sessionId: string;
    projectId?: string;
    content: string;
    weaknesses?: string;
  }): Promise<void> {
    const userId = await getDemoUserId();

    await prisma.dailySummary.create({
      data: {
        userId,
        projectId: params.projectId,
        aiDraft: params.content,
        weaknesses: params.weaknesses
      }
    });
  },

  async saveMemory(params: {
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
    sessionId: string;
    type: "weakness" | "progress" | "preference";
    title: string;
    content: string;
  }): Promise<void> {
<<<<<<< HEAD
    // TODO(第3步): Memory 迁到 Prisma 后在此落库。
  }
};
=======
    void params.sessionId;

    await memoryService.create({
      type: params.type,
      title: params.title,
      content: params.content
    });
  }
};
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
