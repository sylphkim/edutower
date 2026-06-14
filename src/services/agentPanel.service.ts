import { projectsRepository } from "../repositories/projects.repository";
import { conversationsRepository } from "../repositories/conversations.repository";
import { dailyTasksService } from "./dailyTasks.service";
import { getDemoProjectId } from "./demoProject.service";
import { getDemoUserId } from "./demoUser.service";
import { wrongbookService } from "./wrongbook.service";
import { inferTopicFromMessage, truncateFocusLabel } from "../utils/topicInference";
import type { AgentPanelPayload, ReviewProgressPayload } from "../types/agentPanel";
import type { DailyTaskItem } from "../types/dailyTasks";

export interface BuildAgentPanelParams {
  sessionId: string;
  conversationId?: string;
  topicHint?: string;
  lastMessageHint?: string;
}
function buildIdleAgentSteps(): AgentPanelPayload["agent"] {
  return {
    activeLabel: "Agent 就绪 · 等待提问",
    steps: [
      { label: "读取当前对话上下文", status: "pending" },
      { label: "结合学习档案分析", status: "pending" },
      { label: "生成回答与练习建议", status: "pending" }
    ]
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
function countTasksByType(tasks: DailyTaskItem[], type: DailyTaskItem["type"]): number {
  return tasks.filter((task) => task.type === type && task.status !== "cancelled").length;
}

function countDoneTasksByType(tasks: DailyTaskItem[], type: DailyTaskItem["type"]): number {
  return tasks.filter((task) => task.type === type && task.status === "done").length;
}

function buildTaskProgressPercent(tasks: DailyTaskItem[]): number {
  const activeTasks = tasks.filter((task) => task.status !== "cancelled");

  if (!activeTasks.length) {
    return 0;
  }

  const doneCount = activeTasks.filter((task) => task.status === "done").length;
  return Math.round((doneCount / activeTasks.length) * 100);
}

async function buildReviewProgress(): Promise<ReviewProgressPayload> {
  const userId = await getDemoUserId();
  const projectId = await getDemoProjectId();
  const project = await projectsRepository.findByIdForUser(projectId, userId);
  const record = await dailyTasksService.getToday(projectId);
  const tasks = record.sheet?.tasks ?? [];
  const errorCorrections = await countReviewedWrongbookItems();
  const projectTitle = project?.title?.trim() || "学习计划";

  if (!tasks.length) {
    return {
      percent: 0,
      subject: projectTitle,
      topic: "今日尚未启用",
      stats: {
        knowledgePoints: 0,
        practiceQuestions: 0,
        errorCorrections
      }
    };
  }

  return {
    percent: buildTaskProgressPercent(tasks),
    subject: projectTitle,
    topic: "今日学习",
    stats: {
      knowledgePoints: countTasksByType(tasks, "master_skill"),
      practiceQuestions: countTasksByType(tasks, "practice_quiz"),
      errorCorrections: Math.max(errorCorrections, countDoneTasksByType(tasks, "review_wrongbook"))
    }
  };
}

async function countReviewedWrongbookItems(): Promise<number> {
  const payload = await wrongbookService.list();

  return payload.items.filter((item) => item.reviewCount > 0).length;
}

export const agentPanelService = {
  async buildPanel({
    sessionId,
    conversationId,
    topicHint,
    lastMessageHint
  }: BuildAgentPanelParams): Promise<AgentPanelPayload> {
    const userId = await getDemoUserId();
    const messageCount = await conversationsRepository.countMessagesForUser({
      userId,
      sessionId,
      conversationId
    });

    let agent: AgentPanelPayload["agent"] = buildIdleAgentSteps();

    if (messageCount > 0) {
      const latestUserMessage =
        lastMessageHint?.trim() ||
        (await conversationsRepository.findLatestUserMessageForUser({
          userId,
          sessionId,
          conversationId
        })) ||
        "";

      const topic =
        topicHint?.trim() ||
        (latestUserMessage ? inferTopicFromMessage(latestUserMessage) : "综合复习");

      agent = buildConversationAgentSteps(topic, latestUserMessage || topic);
    }

    const progress = await buildReviewProgress();
    return {
      agent,
      progress,
      generatedAt: new Date().toISOString()
    };
  }
};
