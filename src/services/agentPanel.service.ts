import { wrongbookService } from "./wrongbook.service";
import { getDemoProjectId, getDemoUserId } from "./demo.service";
import { projectsRepository } from "../repositories/projects.repository";
import { conversationsRepository } from "../repositories/conversations.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import { quizzesRepository } from "../repositories/quizzes.repository";
import { dailyTaskSheetsRepository } from "../repositories/dailyTaskSheets.repository";
import { agentStatusService } from "./agentStatus.service";
import { inferTopicFromMessage, truncateFocusLabel } from "../utils/topicInference";
import type { AgentPanelPayload, AgentStep } from "../types/agentPanel";

export interface BuildAgentPanelParams {
  sessionId: string;
  conversationId?: string;
  projectId?: string;
  topicHint?: string;
  lastMessageHint?: string;
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

function buildConversationAgentSteps(
  topic: string,
  userQuestion: string
): AgentPanelPayload["agent"] {
  const focus = truncateFocusLabel(userQuestion);

  return {
    activeLabel: `推理中 · ${topic}`,
    steps: [
      { label: "读取当前对话与问题", status: "done" },
      { label: `识别主题：${topic}`, status: "done" },
      { label: `组织回答：${focus}`, status: "current" },
      { label: "补充练习与关联知识点", status: "pending" }
    ]
  };
}

function averageMastery(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

async function countReviewedWrongbookItems(): Promise<number> {
  const payload = await wrongbookService.list();

  return payload.items.filter((item) => item.reviewCount > 0).length;
}

export const agentPanelService = {
  async buildPanel({
    sessionId,
    conversationId,
    projectId: paramProjectId,
    topicHint,
    lastMessageHint
  }: BuildAgentPanelParams): Promise<AgentPanelPayload> {
    const safeSessionId = (sessionId || "").trim() || "default";
    const resolvedProjectId = paramProjectId || (await getDemoProjectId());
    const userId = await getDemoUserId();
    const project = await projectsRepository.upsertDemoProject(userId);
    const { subject, topic } = parseSubjectLine(project.subject);

    const knowledgeNodes = await knowledgeNodesRepository.listByProject(resolvedProjectId);
    const knowledgePointCount = knowledgeNodes.length;
    const percent = averageMastery(knowledgeNodes.map((item) => item.mastery));

    const practiceQuestions = await quizzesRepository.countByProject(resolvedProjectId);
    const errorCorrections = await countReviewedWrongbookItems();

    const messageCount = await conversationsRepository.countMessagesForUser({
      userId,
      sessionId: safeSessionId,
      conversationId
    });

    let agent: AgentPanelPayload["agent"];

    if (messageCount > 0) {
      const latestUserMessage =
        lastMessageHint?.trim() ||
        (await conversationsRepository.findLatestUserMessageForUser({
          userId,
          sessionId: safeSessionId,
          conversationId
        })) ||
        "";

      const inferredTopic =
        topicHint?.trim() ||
        (latestUserMessage ? inferTopicFromMessage(latestUserMessage) : "综合复习");

      agent = buildConversationAgentSteps(inferredTopic, latestUserMessage || inferredTopic);
    } else {
      const weakPoints = await dailyTaskSheetsRepository.collectActiveWeakPoints(resolvedProjectId);
      const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const primaryWeakPoint = [...weakPoints].sort(
        (a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0)
      )[0];

      const activeStatus = agentStatusService.getPhase(safeSessionId);
      const isBusy = activeStatus.phase !== "idle";

      const summarySteps: AgentStep[] = [
        { label: `知识点已加载（${knowledgePointCount} 项）`, status: "done" },
        { label: `练习题已就绪（${practiceQuestions} 次）`, status: "done" },
        {
          label: `错题待订正（${errorCorrections} 项）`,
          status: errorCorrections > 0 ? "current" : "done"
        },
        { label: `当前主题：${topic}`, status: "info" }
      ];

      if (isBusy) {
        summarySteps.unshift({
          label: activeStatus.activeLabel,
          status: "current"
        });
      }

      agent = {
        activeLabel: isBusy
          ? activeStatus.activeLabel
          : primaryWeakPoint
            ? `就绪 · ${primaryWeakPoint.title}`
            : "就绪 · 系统已就绪",
        steps: summarySteps
      };
    }

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
