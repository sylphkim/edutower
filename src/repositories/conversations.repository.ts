import { prisma } from "../lib/prisma";
import type { Conversation, ConversationType } from "../generated/prisma/client";
import type {
  ConversationGetPayload,
  ConversationInclude
} from "../generated/prisma/models";

export interface CreateConversationRecordInput {
  userId: string;
  projectId?: string | null;
  type: ConversationType;
  title?: string | null;
  externalSessionId?: string | null;
}

const messagesInclude = {
  messages: {
    orderBy: [
      {
        createdAt: "asc"
      },
      {
        id: "asc"
      }
    ]
  }
} satisfies ConversationInclude;

export type ConversationWithMessages = ConversationGetPayload<{
  include: typeof messagesInclude;
}>;

export const conversationsRepository = {
  create(input: CreateConversationRecordInput): Promise<Conversation> {
    return prisma.conversation.create({
      data: {
        userId: input.userId,
        projectId: input.projectId ?? null,
        type: input.type,
        title: input.title ?? null,
        externalSessionId: input.externalSessionId ?? null
      }
    });
  },

  findByIdForUser(id: string, userId: string): Promise<ConversationWithMessages | null> {
    return prisma.conversation.findFirst({
      where: {
        id,
        userId
      },
      include: messagesInclude
    });
  },

  listByUser(userId: string, limit = 50) {
    return prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1
        },
        _count: {
          select: { messages: true }
        }
      }
    });
  },

  countMessagesForUser(input: {
    userId: string;
    sessionId?: string;
    conversationId?: string;
  }): Promise<number> {
    if (input.conversationId) {
      return prisma.message.count({
        where: {
          conversation: {
            id: input.conversationId,
            userId: input.userId
          }
        }
      });
    }

    if (input.sessionId) {
      return prisma.message.count({
        where: {
          conversation: {
            externalSessionId: input.sessionId,
            userId: input.userId
          }
        }
      });
    }

    return Promise.resolve(0);
  },

  findLatestUserMessageForUser(input: {
    userId: string;
    sessionId?: string;
    conversationId?: string;
  }): Promise<string | null> {
    const where =
      input.conversationId !== undefined
        ? {
            role: "user" as const,
            conversation: {
              id: input.conversationId,
              userId: input.userId
            }
          }
        : input.sessionId
          ? {
              role: "user" as const,
              conversation: {
                externalSessionId: input.sessionId,
                userId: input.userId
              }
            }
          : null;

    if (!where) {
      return Promise.resolve(null);
    }

    return prisma.message
      .findFirst({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      })
      .then((message) => message?.content?.trim() || null);
  },

  async appendExchangeForUser(input: {
    conversationId: string;
    userId: string;
    userMessage: string;
    aiReply: string;
  }): Promise<void> {
    await prisma.conversation.update({
      where: {
        id: input.conversationId,
        userId: input.userId
      },
      data: {
        messages: {
          create: [
            {
              role: "user",
              content: input.userMessage
            },
            {
              role: "assistant",
              content: input.aiReply
            }
          ]
        }
      }
    });
  }
};
