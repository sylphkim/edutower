import { chatContextService } from "./chatContext.service";
import { wrongbookService } from "./wrongbook.service";
import type { AgentPanelPayload } from "../types/agentPanel";

export interface BuildAgentPanelParams {
  sessionId: string;
}

function parseSubjectLine(subjectName: string): { subject: string; topic: string } {
  const parts = subjectName.split(/[:：]/);

  if (parts.length >= 2) {
    return {
      subject: parts[0].trim(),
      topic: parts.slice(1).join("：").trim()
    };
  }

  return {
    subject: subjectName.trim() || "综合",
    topic: "今日复习"
  };
}

function buildAgentSteps(
  topic: string,
  weakPointTitle: string | undefined
): { activeLabel: string; steps: AgentPanelPayload["agent"]["steps"] } {
  const focusLabel = weakPointTitle ? `聚焦：${weakPointTitle}` : "生成考点知识图谱";

  return {
    activeLabel: weakPointTitle ? `推理中 · ${weakPointTitle}` : "推理中 · 考点路径规划",
    steps: [
      { label: "读取学习档案与错题标签", status: "done" },
      { label: `匹配「${topic}」薄弱子项`, status: "done" },
      { label: focusLabel, status: "current" },
      { label: "推送配套练习与复盘建议", status: "pending" }
    ]
  };
}

function averageMastery(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100);
}

function countReviewedWrongbookItems(): number {
  return wrongbookService.list().items.filter((item) => item.reviewCount > 0).length;
}

export const agentPanelService = {
  buildPanel({ sessionId }: BuildAgentPanelParams): AgentPanelPayload {
    const context = chatContextService.buildContext({ sessionId });
    const { subject, topic } = parseSubjectLine(context.subject.name);
    const primaryWeakPoint = context.weakPoints[0];
    const agent = buildAgentSteps(topic, primaryWeakPoint?.title);

    const knowledgePointCount = context.knowledgePoints.length;
    const practiceQuestions = Math.max(1, context.weakPoints.length * 4);
    const errorCorrections = countReviewedWrongbookItems();
    const percent = averageMastery(context.knowledgePoints.map((item) => item.mastery));

    return {
      agent,
      progress: {
        percent,
        subject,
        topic,
        stats: {
          knowledgePoints: knowledgePointCount,
          practiceQuestions,
          errorCorrections
        }
      },
      generatedAt: new Date().toISOString()
    };
  }
};
