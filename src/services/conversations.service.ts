import {
  conversationsRepository,
  type ConversationWithMessages
} from "../repositories/conversations.repository";
import { projectsRepository } from "../repositories/projects.repository";
import type {
  Conversation,
  ConversationType as PrismaConversationType,
  Message
} from "../generated/prisma/client";
import type {
  ConversationDetail,
  ConversationItem,
  ConversationType,
  CreateConversationInput,
  MessageItem,
  MessageRole
} from "../types/conversation";
import { AppError } from "../utils/errors";
import { getDemoProjectId } from "./demoProject.service";
import { getDemoUserId } from "./demoUser.service";

const VALID_TYPES: ConversationType[] = ["free_qa", "project_setup", "project_study"];

function ensureConversationExists(
  item: ConversationWithMessages | null
): ConversationWithMessages {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Conversation not found.", 404);
  }

  return item;
}

function ensureValidCreateInput(input: CreateConversationInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (input.type !== undefined && !VALID_TYPES.includes(input.type)) {
    throw new AppError(
      "INVALID_REQUEST",
      `type must be one of: ${VALID_TYPES.join(", ")}.`,
      400
    );
  }

  if (input.title !== undefined && typeof input.title !== "string") {
    throw new AppError("INVALID_REQUEST", "title must be a string.", 400);
  }
}

async function resolveProjectIdForUser(
  projectId: string | undefined,
  userId: string
): Promise<string> {
  if (projectId === undefined) {
    return getDemoProjectId();
  }

  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new AppError("INVALID_REQUEST", "projectId must be a non-empty string.", 400);
  }

  const project = await projectsRepository.findByIdForUser(projectId, userId);

  if (!project) {
    throw new AppError(
      "INVALID_REQUEST",
      "projectId must reference an existing project.",
      400
    );
  }

  return project.id;
}

function toApiMessage(message: Message): MessageItem {
  return {
    id: message.id,
    role: message.role as MessageRole,
    content: message.content,
    createdAt: message.createdAt.toISOString()
  };
}

function toApiConversation(conversation: Conversation): ConversationItem {
  return {
    id: conversation.id,
    projectId: conversation.projectId,
    type: conversation.type as ConversationType,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  };
}

function toApiConversationDetail(
  conversation: ConversationWithMessages
): ConversationDetail {
  return {
    ...toApiConversation(conversation),
    messages: conversation.messages.map(toApiMessage)
  };
}

export const conversationsService = {
  async create(input: CreateConversationInput): Promise<ConversationItem> {
    ensureValidCreateInput(input);

    const userId = await getDemoUserId();
    const projectId = await resolveProjectIdForUser(input.projectId, userId);
    const conversation = await conversationsRepository.create({
      userId,
      projectId,
      type: (input.type ?? "project_study") as PrismaConversationType,
      title: input.title?.trim() ? input.title.trim() : null
    });

    return toApiConversation(conversation);
  },

  async getById(id: string): Promise<ConversationDetail> {
    const userId = await getDemoUserId();
    const conversation = ensureConversationExists(
      await conversationsRepository.findByIdForUser(id, userId)
    );

    return toApiConversationDetail(conversation);
  }
};
