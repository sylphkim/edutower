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
