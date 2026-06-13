import type {
  KnowledgeNodeLearningState,
  WeakPointSeverity
} from "../generated/prisma/client";
import {
  dailyTaskSheetsRepository,
  type ActiveWeakPoint,
  type CreateSuggestionRecordInput,
  type DailyTaskSheetWithRelations,
  type DailySummaryWithSuggestions,
  type DayConversationTranscript,
  type DayEvidence,
  type OwnedProjectSummary,
  type SuggestionDecisionRecord
} from "../repositories/dailyTaskSheets.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import type {
  DailyStudyRecord,
  DecideSuggestionsInput,
  DecideSuggestionsResult,
  SuggestionDecisionInput
} from "../types/dailyTasks";
import { AppError } from "../utils/errors";
import { getLocalDayEnd, getLocalDayStart } from "../utils/localDate";
import { logger } from "../utils/logger";
import {
  toDailyConversationItem,
  toDailySheetItem,
  toDailySummaryItem
} from "./dailyTaskMappers";
import { aiEngineService } from "./aiEngine.service";
import { getDemoUserId } from "./demoUser.service";
import { conceptMappingService } from "./conceptMapping.service";
import { memoryService } from "./memory.service";

type CloseReason = "all_tasks_done" | "user" | "midnight";

const VALID_DECISION_ACTIONS = new Set(["accept", "modify", "reject"]);
const VALID_LEARNING_STATES = new Set(["not_started", "learning", "mastered"]);
const MAX_DECISIONS_PER_REQUEST = 50;

interface NodeDayEvidence {
  attempts: number;
  correct: number;
  accuracy: number | null;
  newWrongbookCount: number;
}

interface ActiveNodeInfo {
  id: string;
  title: string;
  learningState: KnowledgeNodeLearningState;
  mastery: number;
}

function clampMastery(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatAccuracy(accuracy: number): string {
  return `${Math.round(accuracy * 100)}%`;
}

function buildNodeEvidence(evidence: DayEvidence): Map<string, NodeDayEvidence> {
  const map = new Map<string, NodeDayEvidence>();

  const ensure = (nodeId: string): NodeDayEvidence => {
    let entry = map.get(nodeId);

    if (!entry) {
      entry = { attempts: 0, correct: 0, accuracy: null, newWrongbookCount: 0 };
      map.set(nodeId, entry);
    }

    return entry;
  };

  for (const attempt of evidence.quizAttempts) {
    const entry = ensure(attempt.knowledgeNodeId);
    entry.attempts += 1;

    if (attempt.isCorrect) {
      entry.correct += 1;
    }
  }

  for (const item of evidence.newWrongbookItems) {
    if (item.knowledgeNodeId) {
      ensure(item.knowledgeNodeId).newWrongbookCount += 1;
    }
  }

  for (const entry of map.values()) {
    entry.accuracy = entry.attempts > 0 ? entry.correct / entry.attempts : null;
  }

  return map;
}

function assessWeakness(
  evidence: NodeDayEvidence
): { severity: WeakPointSeverity; basis: string[] } | undefined {
  let severity: WeakPointSeverity | undefined;
  const basis: string[] = [];

  if (evidence.attempts >= 2 && evidence.accuracy !== null && evidence.accuracy < 0.5) {
    severity = evidence.accuracy < 0.25 ? "high" : "medium";
    basis.push(
      `今日测验 ${evidence.attempts} 题正确率仅 ${formatAccuracy(evidence.accuracy)}`
    );
  }

  if (evidence.newWrongbookCount >= 2) {
    const wrongbookSeverity: WeakPointSeverity =
      evidence.newWrongbookCount >= 4 ? "high" : "medium";

    if (!severity || (severity === "medium" && wrongbookSeverity === "high")) {
      severity = wrongbookSeverity;
    }

    basis.push(`今日新增 ${evidence.newWrongbookCount} 道错题`);
  }

  return severity ? { severity, basis } : undefined;
}

async function loadActiveNodes(projectId: string): Promise<Map<string, ActiveNodeInfo>> {
  const nodes = await knowledgeNodesRepository.listByProject(projectId);

  return new Map(
    nodes
      .filter((node) => node.archivedAt === null)
      .map((node) => [
        node.id,
        {
          id: node.id,
          title: node.title,
          learningState: node.learningState,
          mastery: node.mastery
        }
      ])
  );
}

/**
 * Deterministic suggestion rules. AI never decides state changes directly;
 * every change is proposed here, then confirmed by the user (or by the system
 * at midnight, with the evidence retained on the resulting records).
 */
function buildRuleSuggestions(
  sheet: DailyTaskSheetWithRelations,
  activeNodes: Map<string, ActiveNodeInfo>,
  nodeEvidence: Map<string, NodeDayEvidence>,
  baselineWeakPoints: ActiveWeakPoint[]
): CreateSuggestionRecordInput[] {
  const suggestions: CreateSuggestionRecordInput[] = [];
  const tasks = sheet.tasks.filter((task) => task.status !== "cancelled");
  const taskNodeIds = new Set(
    tasks
      .map((task) => task.knowledgeNodeId)
      .filter((nodeId): nodeId is string => Boolean(nodeId))
  );

  for (const nodeId of taskNodeIds) {
    const node = activeNodes.get(nodeId);

    if (!node) {
      continue;
    }

    const nodeTasks = tasks.filter((task) => task.knowledgeNodeId === nodeId);
    const doneTasks = nodeTasks.filter((task) => task.status === "done");
    const allDone = nodeTasks.length > 0 && doneTasks.length === nodeTasks.length;
    const evidence =
      nodeEvidence.get(nodeId) ??
      ({ attempts: 0, correct: 0, accuracy: null, newWrongbookCount: 0 } as NodeDayEvidence);

    if (node.learningState === "not_started" && doneTasks.length > 0) {
      suggestions.push({
        type: "knowledge_status",
        knowledgeNodeId: nodeId,
        studyTaskId: doneTasks[0].id,
        content: `今天完成了「${node.title}」的学习任务，建议将其状态更新为「学习中」。`,
        proposedLearningState: "learning",
        proposedMastery: Math.max(node.mastery, 30)
      });
      continue;
    }

    if (node.learningState === "learning" && allDone) {
      if (evidence.accuracy !== null && evidence.attempts >= 2 && evidence.accuracy >= 0.8) {
        suggestions.push({
          type: "knowledge_status",
          knowledgeNodeId: nodeId,
          studyTaskId: doneTasks[0]?.id,
          content: `「${node.title}」今日任务全部完成，测验 ${evidence.attempts} 题正确率 ${formatAccuracy(
            evidence.accuracy
          )}，建议标记为「已掌握」。`,
          proposedLearningState: "mastered",
          proposedMastery: Math.max(node.mastery, 80)
        });
      } else if (evidence.attempts === 0) {
        const proposedMastery = Math.min(70, Math.max(node.mastery + 10, 40));

        if (proposedMastery > node.mastery) {
          suggestions.push({
            type: "knowledge_status",
            knowledgeNodeId: nodeId,
            studyTaskId: doneTasks[0]?.id,
            content: `「${node.title}」今日任务全部完成（暂无测验数据），建议将掌握度提升到 ${proposedMastery}%。`,
            proposedLearningState: "learning",
            proposedMastery
          });
        }
      }
    }
  }

  const weaknessNodeIds = new Set([...taskNodeIds, ...nodeEvidence.keys()]);

  for (const nodeId of weaknessNodeIds) {
    const node = activeNodes.get(nodeId);
    const evidence = nodeEvidence.get(nodeId);

    if (!node || !evidence) {
      continue;
    }

    const assessment = assessWeakness(evidence);

    if (!assessment) {
      continue;
    }

    suggestions.push({
      type: "weakness",
      knowledgeNodeId: nodeId,
      content: `「${node.title}」${assessment.basis.join("，")}，建议标记为薄弱点并安排巩固练习。`
    });
  }

  const unfinishedTasks = tasks.filter(
    (task) => task.status === "todo" || task.status === "in_progress"
  );

  if (unfinishedTasks.length > 0) {
    const titles = unfinishedTasks.map((task) => `「${task.title}」`).join("、");
    suggestions.push({
      type: "review_suggestion",
      content: `今日有 ${unfinishedTasks.length} 个任务未完成：${titles}。系统会在明日生成任务时优先续排。`
    });
  }

  // 基线薄弱点里今日表现明显改善的（≥2 题且正确率 ≥80%），提一条「建议解决」待确认。
  for (const weakPoint of baselineWeakPoints) {
    const evidence = nodeEvidence.get(weakPoint.knowledgeNodeId);

    if (
      !evidence ||
      evidence.accuracy === null ||
      evidence.attempts < 2 ||
      evidence.accuracy < 0.8
    ) {
      continue;
    }

    const node = activeNodes.get(weakPoint.knowledgeNodeId);
    const title = node?.title ?? weakPoint.title;

    suggestions.push({
      type: "weakness_resolved",
      knowledgeNodeId: weakPoint.knowledgeNodeId,
      content: `「${title}」今日测验 ${evidence.attempts} 题正确率 ${formatAccuracy(
        evidence.accuracy
      )}，表现明显改善，建议将该薄弱点标记为已解决。`
    });
  }

  return suggestions;
}

function buildTemplateSummary(
  project: OwnedProjectSummary,
  sheet: DailyTaskSheetWithRelations,
  evidence: DayEvidence
): string {
  const tasks = sheet.tasks.filter((task) => task.status !== "cancelled");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const unfinishedTasks = tasks.filter(
    (task) => task.status === "todo" || task.status === "in_progress"
  );
  const attempts = evidence.quizAttempts.length;
  const correct = evidence.quizAttempts.filter((attempt) => attempt.isCorrect).length;

  const lines = [
    `${sheet.localDate} 学习总结（${project.title}）：`,
    `完成任务 ${doneTasks.length}/${tasks.length} 个${
      doneTasks.length > 0
        ? `：${doneTasks.map((task) => `「${task.title}」`).join("、")}`
        : "。"
    }`
  ];

  if (attempts > 0) {
    lines.push(`测验作答 ${attempts} 题，正确 ${correct} 题。`);
  }

  if (evidence.newWrongbookItems.length > 0) {
    lines.push(`新增错题 ${evidence.newWrongbookItems.length} 道。`);
  }

  if (evidence.conversations.length > 0) {
    lines.push(`今日进行了 ${evidence.conversations.length} 段学习对话。`);
  }

  if (unfinishedTasks.length > 0) {
    lines.push(
      `未完成任务 ${unfinishedTasks.length} 个，将在明日优先续排：${unfinishedTasks
        .map((task) => `「${task.title}」`)
        .join("、")}。`
    );
  } else if (tasks.length > 0 && doneTasks.length === tasks.length) {
    lines.push("今日任务全部完成，继续保持。");
  }

  return lines.join("\n");
}

const MAX_CONVERSATION_DIGEST_CHARS = 3000;

function buildConversationDigest(transcripts: DayConversationTranscript[]): string | null {
  if (transcripts.length === 0) {
    return null;
  }

  const blocks = transcripts.map((transcript) => {
    const header = transcript.title ? `【对话：${transcript.title}】` : "【学习对话】";
    const lines = transcript.messages.map(
      (message) => `${message.role === "user" ? "学生" : "助教"}：${message.content}`
    );

    return [header, ...lines].join("\n");
  });

  const digest = blocks.join("\n\n");

  if (digest.length <= MAX_CONVERSATION_DIGEST_CHARS) {
    return digest;
  }

  // 超长时保留最近的部分（末尾），并标注前文已省略。
  return `……（较早对话已省略）\n${digest.slice(digest.length - MAX_CONVERSATION_DIGEST_CHARS)}`;
}

function isEasedToday(evidence: NodeDayEvidence | undefined): boolean {
  return (
    evidence !== undefined &&
    evidence.accuracy !== null &&
    evidence.attempts >= 2 &&
    evidence.accuracy >= 0.8
  );
}

/** 对比基线 active 薄弱点与今日信号，给出「新增 / 改善 / 仍需巩固」的变化描述。 */
function buildWeakPointDelta(
  baselineWeakPoints: ActiveWeakPoint[],
  nodeEvidence: Map<string, NodeDayEvidence>,
  suggestions: CreateSuggestionRecordInput[],
  activeNodes: Map<string, ActiveNodeInfo>
): string | null {
  const baselineNodeIds = new Set(baselineWeakPoints.map((wp) => wp.knowledgeNodeId));
  const titleOf = (nodeId: string): string =>
    activeNodes.get(nodeId)?.title ??
    baselineWeakPoints.find((wp) => wp.knowledgeNodeId === nodeId)?.title ??
    "未知知识点";

  const newlyFlagged = suggestions
    .filter(
      (suggestion) =>
        suggestion.type === "weakness" &&
        suggestion.knowledgeNodeId !== undefined &&
        !baselineNodeIds.has(suggestion.knowledgeNodeId)
    )
    .map((suggestion) => suggestion.knowledgeNodeId as string);

  const eased = baselineWeakPoints
    .filter((wp) => isEasedToday(nodeEvidence.get(wp.knowledgeNodeId)))
    .map((wp) => wp.knowledgeNodeId);
  const easedSet = new Set(eased);

  const stillWeak = baselineWeakPoints
    .filter((wp) => !easedSet.has(wp.knowledgeNodeId))
    .map((wp) => wp.knowledgeNodeId);

  if (newlyFlagged.length === 0 && eased.length === 0 && stillWeak.length === 0) {
    return null;
  }

  const parts: string[] = [];

  if (newlyFlagged.length > 0) {
    parts.push(`新增 ${newlyFlagged.length} 个（${newlyFlagged.map(titleOf).join("、")}）`);
  }

  if (eased.length > 0) {
    parts.push(`今日改善 ${eased.length} 个（${eased.map(titleOf).join("、")}）`);
  }

  if (stillWeak.length > 0) {
    parts.push(`仍需巩固 ${stillWeak.length} 个（${stillWeak.map(titleOf).join("、")}）`);
  }

  return `薄弱点变化：${parts.join("；")}。`;
}

async function buildSummaryDraft(
  project: OwnedProjectSummary,
  sheet: DailyTaskSheetWithRelations,
  evidence: DayEvidence,
  conversationDigest: string | null,
  weakPointDeltaText: string | null
): Promise<string> {
  const template = buildTemplateSummary(project, sheet, evidence);
  const studyData = weakPointDeltaText ? `${template}\n${weakPointDeltaText}` : template;

  // 优先经 FastAPI AI Engine 出总结；FastAPI 不可用时内部回退本地 LLM，
  // 两条路都拿不到文本（含未配置 key）时返回 null，这里再退回确定性模板。
  const aiText = await aiEngineService.generateSummary({
    project: {
      title: project.title,
      subject: project.subject,
      goal: project.goal
    },
    localDate: sheet.localDate,
    studyData,
    conversationDigest
  });

  return aiText ?? studyData;
}

function confirmationSourceForReason(
  reason: CloseReason
): "user" | "system" | "system_forced" {
  if (reason === "user") {
    return "user";
  }

  return reason === "all_tasks_done" ? "system" : "system_forced";
}

function writeDailySummaryMemory(params: {
  content: string;
  weaknesses?: string | null;
  completedTaskIds: string[];
  learnedSkillIds: string[];
}): void {
  // 记忆写入是结束流程的副作用：异步进行、失败只告警，不阻塞 close。
  void memoryService
    .createDailySummary({
      summary: params.content,
      weaknesses: params.weaknesses
        ? params.weaknesses.split("\n").filter(Boolean)
        : undefined,
      completedTaskIds: params.completedTaskIds.length
        ? params.completedTaskIds
        : undefined,
      learnedSkillIds: params.learnedSkillIds.length
        ? params.learnedSkillIds
        : undefined
    })
    .catch((error) => {
      logger.warn("Failed to write daily summary memory.", error);
    });
}

/**
 * 把当天确认「掌握 / 学习中」的知识点写进概念账本（跨项目点亮的数据来源）。
 * 与记忆写入一样是结束流程的副作用：异步进行、失败只告警，不阻塞主流程。
 */
function recordConceptMastery(projectId: string, nodeIds: string[]): void {
  if (nodeIds.length === 0) {
    return;
  }

  void (async () => {
    const userId = await getDemoUserId();
    await conceptMappingService.recordNodeMastery(userId, projectId, nodeIds);
  })().catch((error) => {
    logger.warn("Failed to record concept mastery.", error);
  });
}

async function buildDailyRecord(
  projectId: string,
  sheetId: string
): Promise<DailyStudyRecord> {
  const sheet = await dailyTaskSheetsRepository.findSheetById(sheetId, projectId);

  if (!sheet) {
    throw new AppError("INTERNAL_ERROR", "Daily task sheet could not be reloaded.", 500);
  }

  const evidence = await dailyTaskSheetsRepository.collectDayEvidence(
    projectId,
    getLocalDayStart(sheet.localDate),
    getLocalDayEnd(sheet.localDate)
  );

  return {
    sheet: toDailySheetItem(sheet),
    summary: sheet.dailySummary ? toDailySummaryItem(sheet.dailySummary) : null,
    conversations: evidence.conversations.map(toDailyConversationItem)
  };
}

function normalizeDecisionInput(input: unknown): {
  decisions: SuggestionDecisionInput[];
  confirmedContent?: string;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AppError("INVALID_REQUEST", "Request body must be an object.", 400);
  }

  const body = input as Record<string, unknown>;
  const allowedKeys = new Set(["decisions", "confirmedContent"]);
  const invalidKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));

  if (invalidKeys.length > 0) {
    throw new AppError(
      "INVALID_REQUEST",
      `Request body contains unsupported fields: ${invalidKeys.join(", ")}.`,
      400
    );
  }

  if (!Array.isArray(body.decisions) || body.decisions.length === 0) {
    throw new AppError("INVALID_REQUEST", "decisions must be a non-empty array.", 400);
  }

  if (body.decisions.length > MAX_DECISIONS_PER_REQUEST) {
    throw new AppError(
      "INVALID_REQUEST",
      `decisions cannot contain more than ${MAX_DECISIONS_PER_REQUEST} items.`,
      400
    );
  }

  if (
    body.confirmedContent !== undefined &&
    (typeof body.confirmedContent !== "string" || !body.confirmedContent.trim())
  ) {
    throw new AppError("INVALID_REQUEST", "confirmedContent must be a non-empty string.", 400);
  }

  const seenIds = new Set<string>();
  const decisions = body.decisions.map((entry, index): SuggestionDecisionInput => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new AppError("INVALID_REQUEST", `decisions[${index}] must be an object.`, 400);
    }

    const record = entry as Record<string, unknown>;

    if (typeof record.suggestionId !== "string" || !record.suggestionId.trim()) {
      throw new AppError(
        "INVALID_REQUEST",
        `decisions[${index}].suggestionId is required.`,
        400
      );
    }

    const suggestionId = record.suggestionId.trim();

    if (seenIds.has(suggestionId)) {
      throw new AppError(
        "INVALID_REQUEST",
        `decisions contains duplicate suggestionId: ${suggestionId}.`,
        400
      );
    }

    seenIds.add(suggestionId);

    if (typeof record.action !== "string" || !VALID_DECISION_ACTIONS.has(record.action)) {
      throw new AppError(
        "INVALID_REQUEST",
        `decisions[${index}].action must be one of: accept, modify, reject.`,
        400
      );
    }

    if (
      record.modifiedContent !== undefined &&
      (typeof record.modifiedContent !== "string" || !record.modifiedContent.trim())
    ) {
      throw new AppError(
        "INVALID_REQUEST",
        `decisions[${index}].modifiedContent must be a non-empty string.`,
        400
      );
    }

    if (
      record.proposedLearningState !== undefined &&
      (typeof record.proposedLearningState !== "string" ||
        !VALID_LEARNING_STATES.has(record.proposedLearningState))
    ) {
      throw new AppError(
        "INVALID_REQUEST",
        `decisions[${index}].proposedLearningState must be one of: not_started, learning, mastered.`,
        400
      );
    }

    if (
      record.proposedMastery !== undefined &&
      (typeof record.proposedMastery !== "number" ||
        !Number.isInteger(record.proposedMastery) ||
        record.proposedMastery < 0 ||
        record.proposedMastery > 100)
    ) {
      throw new AppError(
        "INVALID_REQUEST",
        `decisions[${index}].proposedMastery must be an integer between 0 and 100.`,
        400
      );
    }

    const action = record.action as SuggestionDecisionInput["action"];

    if (
      action === "modify" &&
      record.modifiedContent === undefined &&
      record.proposedLearningState === undefined &&
      record.proposedMastery === undefined
    ) {
      throw new AppError(
        "INVALID_REQUEST",
        `decisions[${index}] with action "modify" must override at least one field.`,
        400
      );
    }

    return {
      suggestionId,
      action,
      modifiedContent:
        record.modifiedContent !== undefined
          ? (record.modifiedContent as string).trim()
          : undefined,
      proposedLearningState:
        record.proposedLearningState as SuggestionDecisionInput["proposedLearningState"],
      proposedMastery: record.proposedMastery as number | undefined
    };
  });

  return {
    decisions,
    confirmedContent:
      body.confirmedContent !== undefined
        ? (body.confirmedContent as string).trim()
        : undefined
  };
}

function buildDecisionRecords(params: {
  summary: DailySummaryWithSuggestions;
  decisions: SuggestionDecisionInput[];
  activeNodes: Map<string, ActiveNodeInfo>;
  nodeEvidence: Map<string, NodeDayEvidence>;
  decidedBy: "user" | "system_forced";
  localDate: string | null;
}): SuggestionDecisionRecord[] {
  const suggestionMap = new Map(
    params.summary.suggestions.map((suggestion) => [suggestion.id, suggestion])
  );

  return params.decisions.map((decision): SuggestionDecisionRecord => {
    const suggestion = suggestionMap.get(decision.suggestionId);
    const record: SuggestionDecisionRecord = {
      suggestionId: decision.suggestionId,
      action: decision.action,
      modifiedContent: decision.modifiedContent,
      evidenceSnapshot: {
        decidedBy: params.decidedBy,
        localDate: params.localDate,
        action: decision.action
      }
    };

    if (!suggestion || decision.action === "reject") {
      return record;
    }

    if (suggestion.type === "knowledge_status" && suggestion.knowledgeNodeId) {
      const targetLearningState =
        decision.action === "modify"
          ? decision.proposedLearningState ?? suggestion.proposedLearningState ?? undefined
          : suggestion.proposedLearningState ?? undefined;
      const targetMasteryRaw =
        decision.action === "modify"
          ? decision.proposedMastery ?? suggestion.proposedMastery ?? undefined
          : suggestion.proposedMastery ?? undefined;

      record.targetLearningState = targetLearningState ?? undefined;
      record.targetMastery =
        targetMasteryRaw !== undefined ? clampMastery(targetMasteryRaw) : undefined;
      record.evidenceSnapshot = {
        ...record.evidenceSnapshot,
        suggestionContent: suggestion.content,
        nodeEvidence: params.nodeEvidence.get(suggestion.knowledgeNodeId) ?? null
      };
    }

    if (suggestion.type === "weakness" && suggestion.knowledgeNodeId) {
      const node = params.activeNodes.get(suggestion.knowledgeNodeId);
      const evidence = params.nodeEvidence.get(suggestion.knowledgeNodeId);
      const assessment = evidence ? assessWeakness(evidence) : undefined;

      record.weaknessSeverity = assessment?.severity ?? "medium";
      record.weaknessTitle = node ? `薄弱点：${node.title}` : "薄弱点";
      record.weaknessDescription = decision.modifiedContent ?? suggestion.content;
      record.evidenceSnapshot = {
        ...record.evidenceSnapshot,
        suggestionContent: suggestion.content,
        assessmentBasis: assessment?.basis ?? [],
        nodeEvidence: evidence ?? null
      };
    }

    return record;
  });
}

function throwDecisionFailure(status: string, suggestionId?: string): never {
  switch (status) {
    case "not_found":
      throw new AppError("INVALID_REQUEST", "Daily summary not found.", 404);
    case "not_awaiting":
      throw new AppError(
        "INVALID_REQUEST",
        "Only summaries awaiting confirmation accept decisions.",
        409
      );
    case "unknown_suggestion":
      throw new AppError(
        "INVALID_REQUEST",
        `Suggestion not found in this summary: ${suggestionId}.`,
        404
      );
    case "suggestion_not_pending":
      throw new AppError(
        "INVALID_REQUEST",
        `Suggestion was already decided: ${suggestionId}.`,
        409
      );
    default:
      throw new AppError("INTERNAL_ERROR", "Failed to apply suggestion decisions.", 500);
  }
}

export const dailySummariesService = {
  /**
   * Closes an active sheet: aggregates the day's evidence, generates the
   * summary draft (AI text with deterministic fallback) and rule-based
   * suggestions, then persists everything atomically.
   */
  async closeAndSummarize(
    projectId: string,
    sheetId: string,
    reason: CloseReason,
    now: Date
  ): Promise<DailyStudyRecord> {
    const project = await dailyTaskSheetsRepository.findProjectById(projectId);

    if (!project) {
      throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
    }

    const sheet = await dailyTaskSheetsRepository.findSheetById(sheetId, projectId);

    if (!sheet) {
      throw new AppError("INVALID_REQUEST", "Daily task sheet not found.", 404);
    }

    if (sheet.status !== "active") {
      // Concurrent close already finished the day; treat as idempotent.
      return buildDailyRecord(projectId, sheetId);
    }

    const userId = await getDemoUserId();
    const dayStart = getLocalDayStart(sheet.localDate);
    const dayEnd = getLocalDayEnd(sheet.localDate);
    const [evidence, activeNodes, conversationTranscripts, baselineWeakPoints] =
      await Promise.all([
        dailyTaskSheetsRepository.collectDayEvidence(projectId, dayStart, dayEnd),
        loadActiveNodes(projectId),
        dailyTaskSheetsRepository.collectDayConversationMessages(projectId, dayStart, dayEnd),
        dailyTaskSheetsRepository.collectActiveWeakPoints(projectId)
      ]);
    const nodeEvidence = buildNodeEvidence(evidence);
    const suggestions = buildRuleSuggestions(sheet, activeNodes, nodeEvidence, baselineWeakPoints);
    const conversationDigest = buildConversationDigest(conversationTranscripts);
    const weakPointDeltaText = buildWeakPointDelta(
      baselineWeakPoints,
      nodeEvidence,
      suggestions,
      activeNodes
    );
    const aiDraft = await buildSummaryDraft(
      project,
      sheet,
      evidence,
      conversationDigest,
      weakPointDeltaText
    );
    const weaknessLines = suggestions
      .filter((suggestion) => suggestion.type === "weakness")
      .map((suggestion) => suggestion.content);
    const hasSuggestions = suggestions.length > 0;
    const confirmationSource = confirmationSourceForReason(reason);

    const result = await dailyTaskSheetsRepository.closeSheet({
      sheetId,
      projectId,
      userId,
      closeReason: reason,
      endedAt: now,
      sheetStatus: hasSuggestions
        ? "awaiting_confirmation"
        : reason === "midnight"
          ? "forced_closed"
          : "completed",
      summary: {
        summaryDate: dayStart,
        aiDraft,
        weaknesses: weaknessLines.length > 0 ? weaknessLines.join("\n") : undefined,
        status: hasSuggestions ? "awaiting_confirmation" : "confirmed",
        confirmationSource: hasSuggestions ? undefined : confirmationSource,
        confirmedAt: hasSuggestions ? undefined : now,
        confirmedContent: hasSuggestions ? undefined : aiDraft
      },
      suggestions
    });

    if (result.status === "not_found") {
      throw new AppError("INVALID_REQUEST", "Daily task sheet not found.", 404);
    }

    if (result.status === "success" && !hasSuggestions) {
      writeDailySummaryMemory({
        content: aiDraft,
        weaknesses: weaknessLines.join("\n") || null,
        completedTaskIds: sheet.tasks
          .filter((task) => task.status === "done")
          .map((task) => task.id),
        learnedSkillIds: []
      });
    }

    return buildDailyRecord(projectId, sheetId);
  },

  /** Applies user decisions on pending suggestions and finishes the day when none remain. */
  async decide(
    projectId: string,
    summaryId: string,
    input: unknown
  ): Promise<DecideSuggestionsResult> {
    const normalized: DecideSuggestionsInput = normalizeDecisionInput(input);
    const summary = await dailyTaskSheetsRepository.findSummaryById(summaryId, projectId);

    if (!summary) {
      throw new AppError("INVALID_REQUEST", "Daily summary not found.", 404);
    }

    if (!summary.dailyTaskSheetId) {
      throw new AppError(
        "INVALID_REQUEST",
        "Only summaries linked to a daily task sheet accept decisions.",
        409
      );
    }

    if (summary.status !== "awaiting_confirmation") {
      throw new AppError(
        "INVALID_REQUEST",
        "Only summaries awaiting confirmation accept decisions.",
        409
      );
    }

    const sheet = await dailyTaskSheetsRepository.findSheetById(
      summary.dailyTaskSheetId,
      projectId
    );
    const localDate = sheet?.localDate ?? null;
    const [evidence, activeNodes] = await Promise.all([
      localDate
        ? dailyTaskSheetsRepository.collectDayEvidence(
            projectId,
            getLocalDayStart(localDate),
            getLocalDayEnd(localDate)
          )
        : Promise.resolve({
            quizAttempts: [],
            newWrongbookItems: [],
            conversations: []
          } as DayEvidence),
      loadActiveNodes(projectId)
    ]);
    const nodeEvidence = buildNodeEvidence(evidence);
    const now = new Date();
    const decisionRecords = buildDecisionRecords({
      summary,
      decisions: normalized.decisions,
      activeNodes,
      nodeEvidence,
      decidedBy: "user",
      localDate
    });

    const result = await dailyTaskSheetsRepository.decideSuggestions({
      summaryId,
      projectId,
      decisions: decisionRecords,
      decisionSource: "user",
      decidedAt: now,
      finalSheetStatus: "completed",
      confirmedContentOverride: normalized.confirmedContent
    });

    if (result.status !== "success") {
      throwDecisionFailure(
        result.status,
        "suggestionId" in result ? result.suggestionId : undefined
      );
    }

    const updatedSummary = await dailyTaskSheetsRepository.findSummaryById(
      summaryId,
      projectId
    );
    const updatedSheet = await dailyTaskSheetsRepository.findSheetById(
      summary.dailyTaskSheetId,
      projectId
    );

    if (!updatedSummary || !updatedSheet) {
      throw new AppError("INTERNAL_ERROR", "Failed to reload decided summary.", 500);
    }

    if (result.summaryConfirmed) {
      const learnedSkillIds = updatedSummary.suggestions
        .filter(
          (suggestion) =>
            suggestion.type === "knowledge_status" &&
            (suggestion.status === "accepted" || suggestion.status === "modified") &&
            suggestion.knowledgeNodeId
        )
        .map((suggestion) => suggestion.knowledgeNodeId as string);

      writeDailySummaryMemory({
        content: updatedSummary.confirmedContent ?? updatedSummary.aiDraft,
        weaknesses: updatedSummary.weaknesses,
        completedTaskIds: updatedSheet.tasks
          .filter((task) => task.status === "done")
          .map((task) => task.id),
        learnedSkillIds
      });
      recordConceptMastery(projectId, learnedSkillIds);
    }

    return {
      summary: toDailySummaryItem(updatedSummary),
      sheet: toDailySheetItem(updatedSheet)
    };
  },

  /**
   * System decision path for the midnight cutoff: accepts every pending
   * suggestion as proposed, retaining the evidence used for each judgement.
   */
  async systemDecideSummary(
    projectId: string,
    summary: DailySummaryWithSuggestions,
    localDate: string | null,
    now: Date
  ): Promise<void> {
    if (summary.status !== "awaiting_confirmation" || !summary.dailyTaskSheetId) {
      return;
    }

    const pending = summary.suggestions.filter(
      (suggestion) => suggestion.status === "pending"
    );
    const [evidence, activeNodes] = await Promise.all([
      localDate
        ? dailyTaskSheetsRepository.collectDayEvidence(
            projectId,
            getLocalDayStart(localDate),
            getLocalDayEnd(localDate)
          )
        : Promise.resolve({
            quizAttempts: [],
            newWrongbookItems: [],
            conversations: []
          } as DayEvidence),
      loadActiveNodes(projectId)
    ]);
    const nodeEvidence = buildNodeEvidence(evidence);
    const decisionRecords = buildDecisionRecords({
      summary,
      decisions: pending.map((suggestion) => ({
        suggestionId: suggestion.id,
        action: "accept" as const
      })),
      activeNodes,
      nodeEvidence,
      decidedBy: "system_forced",
      localDate
    }).map((record) => ({
      ...record,
      evidenceSnapshot: {
        ...record.evidenceSnapshot,
        reason: "midnight_auto_close"
      }
    }));

    const result = await dailyTaskSheetsRepository.decideSuggestions({
      summaryId: summary.id,
      projectId,
      decisions: decisionRecords,
      decisionSource: "system_forced",
      decidedAt: now,
      finalSheetStatus: "forced_closed"
    });

    if (result.status !== "success") {
      logger.warn(
        `Midnight system decision skipped for summary ${summary.id}: ${result.status}.`
      );
      return;
    }

    if (result.summaryConfirmed) {
      const updatedSummary = await dailyTaskSheetsRepository.findSummaryById(
        summary.id,
        projectId
      );

      if (updatedSummary) {
        const learnedSkillIds = updatedSummary.suggestions
          .filter(
            (suggestion) =>
              suggestion.type === "knowledge_status" &&
              suggestion.status === "accepted" &&
              suggestion.knowledgeNodeId
          )
          .map((suggestion) => suggestion.knowledgeNodeId as string);

        writeDailySummaryMemory({
          content: updatedSummary.confirmedContent ?? updatedSummary.aiDraft,
          weaknesses: updatedSummary.weaknesses,
          completedTaskIds: [],
          learnedSkillIds
        });
        recordConceptMastery(projectId, learnedSkillIds);
      }
    }
  },

  /** Forces one expired sheet through the midnight close path. */
  async forceCloseSheet(sheet: DailyTaskSheetWithRelations, now: Date): Promise<void> {
    if (sheet.status === "generating" || sheet.status === "generation_failed") {
      await dailyTaskSheetsRepository.forceCloseUngeneratedSheet(sheet.id, now);
      return;
    }

    if (sheet.status === "active") {
      const record = await this.closeAndSummarize(
        sheet.projectId,
        sheet.id,
        "midnight",
        now
      );

      if (record.summary && record.summary.status === "awaiting_confirmation") {
        const summary = await dailyTaskSheetsRepository.findSummaryById(
          record.summary.id,
          sheet.projectId
        );

        if (summary) {
          await this.systemDecideSummary(sheet.projectId, summary, sheet.localDate, now);
        }
      }

      return;
    }

    if (sheet.status === "awaiting_confirmation" && sheet.dailySummary) {
      await this.systemDecideSummary(
        sheet.projectId,
        sheet.dailySummary,
        sheet.localDate,
        now
      );
    }
  },

  /**
   * Settles every expired sheet (project-scoped for the lazy path, global for
   * the sweeper). Errors are logged per sheet so one failure cannot wedge the rest.
   */
  async forceCloseExpiredSheets(now: Date, projectId?: string): Promise<number> {
    const sheets = await dailyTaskSheetsRepository.findExpiredSheets(now, projectId);

    for (const sheet of sheets) {
      try {
        await this.forceCloseSheet(sheet, now);
      } catch (error) {
        logger.error(`Failed to force-close daily sheet ${sheet.id}.`, error);
      }
    }

    return sheets.length;
  }
};
