import { conversationsRepository } from "../repositories/conversations.repository";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { getDemoUserId } from "./demo.service";

const DEFAULT_CONVERSATION_TITLE = "AI Chat";

export interface SaveChatExchangeParams {
  sessionId: string;
  conversationId?: string;
  projectId?: string;
  userMessage: string;
  aiReply: string;
  engine: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

// 解析这一轮问答要落到哪个会话：
// - 传了 conversationId → 用前端显式创建的子对话；
// - 没传 → 按 (userId, externalSessionId) 懒创建/复用一个 free_qa 会话，保证聊天也落库。
// 依赖 @@unique([userId, externalSessionId])：并发首发时两个请求都查不到 → 一个成功创建、
// 另一个撞唯一约束(P2002)，捕获后回查复用，保证「一个 session 恒一条会话」。
async function resolveConversationId(
  params: SaveChatExchangeParams,
  userId: string
): Promise<string> {
  if (params.conversationId) {
    return params.conversationId;
  }

  const where = {
    userId_externalSessionId: {
      userId,
      externalSessionId: params.sessionId
    }
  };

  const existing = await prisma.conversation.findUnique({ where });

  if (existing) {
    return existing.id;
  }

  try {
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
  } catch (error) {
    // 并发下另一个请求已抢先创建 → 回查复用，而不是抛错或落重复。
    if (isUniqueConstraintError(error)) {
      const raced = await prisma.conversation.findUnique({ where });

      if (raced) {
        return raced.id;
      }
    }

    throw error;
  }
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
