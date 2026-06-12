import { conversationsRepository } from "../repositories/conversations.repository";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { getDemoUserId } from "./demoUser.service";

const DEFAULT_CONVERSATION_TITLE = "AI Chat";

export interface SaveChatExchangeParams {
  sessionId: string;
  conversationId?: string;
  projectId?: string;
  userMessage: string;
  aiReply: string;
  engine: string;
}

// 解析这一轮问答要落到哪个会话：
// - 传了 conversationId → 用前端显式创建的子对话；
// - 没传 → 按 sessionId 懒创建/复用一个 free_qa 会话，保证聊天也落库。
async function resolveConversationId(
  params: SaveChatExchangeParams,
  userId: string
): Promise<string> {
  if (params.conversationId) {
    return params.conversationId;
  }

  const existing = await prisma.conversation.findFirst({
    where: { externalSessionId: params.sessionId }
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.conversation.create({
    data: {
      userId,
      projectId: params.projectId,
      type: "free_qa",
      title: DEFAULT_CONVERSATION_TITLE,
      externalSessionId: params.sessionId
    }
  });

  return created.id;
}

export const chatPersistenceService = {
  async saveChatExchange(params: SaveChatExchangeParams): Promise<void> {
    try {
      const userId = await getDemoUserId();
      const conversationId = await resolveConversationId(params, userId);

      await conversationsRepository.appendExchangeForUser({
        conversationId,
        userId,
        userMessage: params.userMessage,
        aiReply: params.aiReply
      });
    } catch (error) {
      // 持久化是尽力而为的副作用：失败只告警，不影响已返回给用户的回复。
      logger.warn("Failed to persist chat exchange.", {
        conversationId: params.conversationId,
        sessionId: params.sessionId,
        error
      });
    }
  }
};
