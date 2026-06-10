import { demoKnowledgePoints } from "../mock/demoKnowledgePoints";
import { demoMaterials } from "../mock/demoMaterials";
import { demoSessionHistory } from "../mock/demoSessionHistory";
import { demoSubject } from "../mock/demoSubject";
import { demoWeakPoints } from "../mock/demoWeakPoints";
import { memoryService } from "./memory.service";
import type { ChatContext, ChatMemory } from "../types/chatContext";

export interface BuildChatContextParams {
  sessionId: string;
}

export const chatContextService = {
  async buildContext({ sessionId }: BuildChatContextParams): Promise<ChatContext> {
    void sessionId;

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

    return {
      subject: demoSubject,
      materials: demoMaterials,
      knowledgePoints: demoKnowledgePoints,
      weakPoints: demoWeakPoints,
      sessionHistory: demoSessionHistory,
      generatedAt: new Date().toISOString(),
      memories,
    };
  }
};