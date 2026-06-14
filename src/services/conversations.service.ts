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
  ConversationListItem,
  ConversationType,
  CreateConversationInput,
  MessageItem,
  MessageRole
} from "../types/conversation";
import { AppError } from "../utils/errors";
import { aiEngineService } from "./aiEngine.service";
import { getDemoProjectId, getDemoUserId } from "./demo.service";
import { memoryService } from "./memory.service";

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

function buildPreview(content: string | undefined): string | null {
  if (!content || !content.trim()) {
    return null;
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 48 ? `${normalized.slice(0, 48)}…` : normalized;
}

const MAX_FREE_QA_DIGEST_CHARS = 3000;

function buildFreeQaDigest(messages: Message[]): string {
  const digest = messages
    .map((message) => `${message.role === "user" ? "学生" : "助教"}：${message.content}`)
    .join("\n");

  if (digest.length <= MAX_FREE_QA_DIGEST_CHARS) {
    return digest;
  }

  return `……（较早对话已省略）\n${digest.slice(digest.length - MAX_FREE_QA_DIGEST_CHARS)}`;
}

function buildFreeQaTemplateSummary(messages: Message[]): string {
  const userMessages = messages.filter((message) => message.role === "user");
  const firstQuestion = userMessages[0]?.content.trim() ?? "";
  const topic = firstQuestion.length > 60 ? `${firstQuestion.slice(0, 60)}…` : firstQuestion;
  const lines = [`本次自由答疑共 ${userMessages.length} 轮提问。`];

  if (topic) {
    lines.push(`主要从「${topic}」展开。`);
  }

  return lines.join("");
}

export const conversationsService = {
  async list(limitRaw?: unknown): Promise<{ items: ConversationListItem[] }> {
    const userId = await getDemoUserId();
    const limit =
      typeof limitRaw === "string" && /^\d+$/.test(limitRaw)
        ? Math.min(100, Math.max(1, Number.parseInt(limitRaw, 10)))
        : 50;

    const items = await conversationsRepository.listByUser(userId, limit);

    return {
      items: items.map((item) => {
        const lastMessage = item.messages[0];

        return {
          ...toApiConversation(item),
          externalSessionId: item.externalSessionId,
          messageCount: item._count.messages,
          preview: buildPreview(lastMessage?.content)
        };
      })
    };
  },

  async create(input: CreateConversationInput): Promise<ConversationItem> {
    ensureValidCreateInput(input);

    const userId = await getDemoUserId();
    const projectId = await resolveProjectIdForUser(input.projectId, userId);
    const conversation = await conversationsRepository.create({
      userId,
      projectId,
      type: (input.type ?? "project_study") as PrismaConversationType,
      title: input.title?.trim() ? input.title.trim() : null,
      externalSessionId: input.externalSessionId?.trim() ? input.externalSessionId.trim() : null
    });

    return toApiConversation(conversation);
  },

  async getById(id: string): Promise<ConversationDetail> {
    const userId = await getDemoUserId();
    const conversation = ensureConversationExists(
      await conversationsRepository.findByIdForUser(id, userId)
    );

    return toApiConversationDetail(conversation);
  },

  /**
   * 自由答疑收口：对话结束时把整段对话总结成一条记忆。
   * 总结优先走 FastAPI（模板兜底），记忆按用户落库。
   * 注：从自由聊天里抽取「学到的概念」喂账本需 FastAPI 概念抽取，留待 v2。
   */
  async summarizeFreeQa(id: string): Promise<{ summary: string; memoryId: string }> {
    const userId = await getDemoUserId();
    const conversation = ensureConversationExists(
      await conversationsRepository.findByIdForUser(id, userId)
    );

    if (conversation.type !== "free_qa") {
      throw new AppError(
        "INVALID_REQUEST",
        "Only free-Q&A conversations can be summarized here.",
        400
      );
    }

    if (conversation.messages.length === 0) {
      throw new AppError("INVALID_REQUEST", "Conversation has no messages to summarize.", 400);
    }

    const digest = buildFreeQaDigest(conversation.messages);
    const aiText = await aiEngineService.summarizeFreeQa(digest);
    const summary = aiText ?? buildFreeQaTemplateSummary(conversation.messages);

    const titleSuffix = conversation.title?.trim() ? `：${conversation.title.trim()}` : "";
    const memory = await memoryService.create({
      type: "note",
      title: `自由答疑小结${titleSuffix}`,
      content: summary,
      importance: "medium"
    });

    return { summary, memoryId: memory.id };
  }
};
