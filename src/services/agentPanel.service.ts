import { wrongbookService } from "./wrongbook.service";
import { getDemoProjectId } from "./demoProject.service";
import { getDemoUserId } from "./demoUser.service";
import { projectsRepository } from "../repositories/projects.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import { quizzesRepository } from "../repositories/quizzes.repository";
import { dailyTaskSheetsRepository } from "../repositories/dailyTaskSheets.repository";
import { agentStatusService } from "./agentStatus.service";
import type { AgentPanelPayload, AgentStep } from "../types/agentPanel";

export interface BuildAgentPanelParams {
  sessionId: string;
  conversationId?: string;
  projectId?: string;
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
  params: {
    topic: string;
    weakPointTitle: string | undefined;
    knowledgePointCount: number;
    practiceQuestions: number;
    errorCorrections: number;
  }
): { activeLabel: string; steps: AgentStep[] } {
  const { topic, weakPointTitle, knowledgePointCount, practiceQuestions, errorCorrections } = params;
  const weakPointText = weakPointTitle ? `聚焦：${weakPointTitle}` : "暂无特定薄弱点";

  return {
    activeLabel: weakPointTitle ? `就绪 · ${weakPointTitle}` : "就绪 · 系统已就绪",
    steps: [
      { label: `知识点已加载（${knowledgePointCount} 项）`, status: "done" },
      { label: `练习题已就绪（${practiceQuestions} 次）`, status: "done" },
      { label: `错题待订正（${errorCorrections} 项）`, status: errorCorrections > 0 ? "current" : "done" },
      { label: `当前主题：${topic}`, status: "info" }
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
  async buildPanel({ sessionId, projectId: paramProjectId }: BuildAgentPanelParams): Promise<AgentPanelPayload> {
    const safeSessionId = (sessionId || "").trim() || "default";
    const resolvedProjectId = paramProjectId || await getDemoProjectId();
    const userId = await getDemoUserId();
    const project = await projectsRepository.upsertDemoProject(userId);
    const { subject, topic } = parseSubjectLine(project.subject);

    const knowledgeNodes = await knowledgeNodesRepository.listByProject(resolvedProjectId);
    const knowledgePointCount = knowledgeNodes.length;
    const percent = averageMastery(knowledgeNodes.map((item) => item.mastery));

    const practiceQuestions = await quizzesRepository.countByProject(resolvedProjectId);
    const errorCorrections = await countReviewedWrongbookItems();

    const weakPoints = await dailyTaskSheetsRepository.collectActiveWeakPoints(resolvedProjectId);
    const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const primaryWeakPoint = [...weakPoints].sort(
      (a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0)
    )[0];

    // 检查是否有实时 Agent 状态（AI 正在推理中）
    const activeStatus = agentStatusService.getPhase(safeSessionId);
    const isBusy = activeStatus.phase !== "idle";

    // 构建代理摘要步骤（基于真实统计数据）
    const summarySteps: AgentStep[] = [
      { label: `知识点已加载（${knowledgePointCount} 项）`, status: "done" },
      { label: `练习题已就绪（${practiceQuestions} 次）`, status: "done" },
      { label: `错题待订正（${errorCorrections} 项）`, status: errorCorrections > 0 ? "current" : "done" },
      { label: `当前主题：${topic}`, status: "info" }
    ];

    // 如果 AI 正在执行，则合并实时状态
    if (isBusy) {
      summarySteps.unshift({
        label: activeStatus.activeLabel,
        status: "current"
      });
    }

    const agent = {
      activeLabel: isBusy ? activeStatus.activeLabel : (primaryWeakPoint ? `就绪 · ${primaryWeakPoint.title}` : "就绪 · 系统已就绪"),
      steps: summarySteps
    };

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
