import { demoKnowledgePoints } from "../mock/demoKnowledgePoints";
import { demoMaterials } from "../mock/demoMaterials";
import { demoSessionHistory } from "../mock/demoSessionHistory";
import { demoSubject } from "../mock/demoSubject";
import { demoWeakPoints } from "../mock/demoWeakPoints";
import type { ChatContext } from "../types/chatContext";

export interface BuildChatContextParams {
  sessionId: string;
}

export const chatContextService = {
  buildContext({ sessionId }: BuildChatContextParams): ChatContext {
    // Demo 阶段暂时忽略真实用户系统；后续可根据 sessionId 查询数据库里的用户资料、历史记录和长期记忆。
    void sessionId;

    return {
      subject: demoSubject,
      materials: demoMaterials,
      knowledgePoints: demoKnowledgePoints,
      weakPoints: demoWeakPoints,
      sessionHistory: demoSessionHistory,
      generatedAt: new Date().toISOString()
    };
  }
};
