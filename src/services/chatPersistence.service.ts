import { prisma } from "../lib/prisma";
import { getDemoUserId } from "./demoUser.service";
import { memoryService } from "./memory.service";

export interface SaveChatExchangeParams {
  sessionId: string;
  projectId?: string;
  userMessage: string;
  aiReply: string;
  engine: string;
}

const DEFAULT_CONVERSATION_TITLE = "AI Chat";

export const chatPersistenceService = {
  async saveChatExchange(params: SaveChatExchangeParams): Promise<void> {
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
    sessionId: string;
    type: "weakness" | "progress" | "preference";
    title: string;
    content: string;
  }): Promise<void> {
    void params.sessionId;

    await memoryService.create({
      type: params.type,
      title: params.title,
      content: params.content
    });
  }
};