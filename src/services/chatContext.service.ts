import { demoKnowledgePoints } from "../mock/demoKnowledgePoints";
import { demoMaterials } from "../mock/demoMaterials";
import { demoSubject } from "../mock/demoSubject";
import { demoWeakPoints } from "../mock/demoWeakPoints";
import { conversationsRepository } from "../repositories/conversations.repository";
import type { ConversationWithMessages } from "../repositories/conversations.repository";
import { getDemoUserId } from "./demoUser.service";
import { memoryService } from "./memory.service";
import type { ChatContext, ChatMemory, DemoSessionMessage } from "../types/chatContext";

// 单轮聊天最多带入的历史消息条数（取最近的），避免长对话把上下文撑爆。
const MAX_SESSION_HISTORY_MESSAGES = 40;

export interface BuildChatContextParams {
  sessionId: string;
  /** 前端显式子对话时传入；优先用它定位会话，否则按 sessionId(externalSessionId) 查。 */
  conversationId?: string;
}

// 把这次请求对应到一条已存在的会话：
// - 传了 conversationId → 取该子对话；
// - 否则按 externalSessionId === sessionId 查（free_qa 懒创建出来的会话）。
// 查不到（如某会话的第一条消息，此时会话还没落库）→ 返回 null，历史按空处理。
async function resolveConversation(
  params: BuildChatContextParams,
  userId: string
): Promise<ConversationWithMessages | null> {
  if (params.conversationId) {
    return conversationsRepository.findByIdForUser(params.conversationId, userId);
  }

  return conversationsRepository.findByExternalSessionIdForUser(params.sessionId, userId);
}

// 会话消息（已按 createdAt 升序）→ 聊天上下文里的 sessionHistory。
// 只保留最近 N 条，仍按时间顺序排列。
function toSessionHistory(conversation: ConversationWithMessages | null): DemoSessionMessage[] {
  if (!conversation) {
    return [];
  }

  return conversation.messages.slice(-MAX_SESSION_HISTORY_MESSAGES).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString()
  }));
}

export const chatContextService = {
  async buildContext(params: BuildChatContextParams): Promise<ChatContext> {
    const userId = await getDemoUserId();

    // 真实聊天记录：按本会话取，替换原来写死的 demoSessionHistory。
    const conversation = await resolveConversation(params, userId);
    const sessionHistory = toSessionHistory(conversation);

    // 从 Memory 表读取长期记忆
    const { items: allMemories } = await memoryService.list();

    // 按 importance 降序 -> createdAt 降序排序，取前 20 条
    const importanceRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const topMemories = allMemories
      .sort((a, b) => {
        const rankDiff = (importanceRank[b.importance] ?? 0) - (importanceRank[a.importance] ?? 0);
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 20);

    const memories: ChatMemory[] = topMemories.map((m) => ({
      type: m.type,
      title: m.title,
      content: m.content
    }));

    // subject / materials / knowledgePoints / weakPoints 仍为 demo，留待第二步按项目接真实数据。
    return {
      subject: demoSubject,
      materials: demoMaterials,
      knowledgePoints: demoKnowledgePoints,
      weakPoints: demoWeakPoints,
      sessionHistory,
      generatedAt: new Date().toISOString(),
      memories,
    };
  }
};
