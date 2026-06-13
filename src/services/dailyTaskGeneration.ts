import type { StudyTaskSource, StudyTaskType } from "../generated/prisma/client";
import type {
  GenerationInputs,
  GenerationKnowledgeNode
} from "../repositories/dailyTaskSheets.repository";

/**
 * Daily task generation uses deterministic rules only on Express.
 * LLM ranking, if added later, must go through FastAPI — never direct LLM here.
 */

export const MAX_DAILY_TASKS = 8;
const MAX_CANDIDATES = 30;
const CATEGORY_CAPS: Record<StudyTaskSource, number> = {
  carry_over: 10,
  weak_point: 8,
  wrongbook: 5,
  plan: 16,
  daily_summary: 0,
  quiz: 0,
  user_requested: 0
};

const DEFAULT_MINUTES_BY_TYPE: Record<StudyTaskType, number> = {
  master_skill: 30,
  practice_quiz: 20,
  review_wrongbook: 15,
  read_material: 20
};

export interface DailyTaskCandidate {
  candidateId: string;
  title: string;
  type: StudyTaskType;
  sourceType: StudyTaskSource;
  knowledgeNodeId?: string;
  materialId?: string;
  planPhaseId?: string;
  carriedFromTaskId?: string;
  estimatedMinutes: number;
  /** Rule priority; lower values are scheduled earlier by the fallback. */
  priority: number;
  defaultReason: string;
  evidence: Record<string, unknown>;
}

export interface SelectedDailyTask {
  candidate: DailyTaskCandidate;
  reason: string;
}

export interface SelectionMeta {
  mode: "ai" | "rules";
  provider?: string;
  model?: string;
  aiNote?: string;
  aiError?: string;
}

export interface BuiltCandidates {
  candidates: DailyTaskCandidate[];
  planVersionId: string | null;
  currentPhaseId: string | null;
  currentPhaseTitle: string | null;
}

export interface GenerationProjectInfo {
  title: string;
  subject: string;
  goal: string;
  targetScore: string | null;
}

export function candidateDedupeKey(
  type: StudyTaskType,
  knowledgeNodeId: string | null | undefined
): string {
  return `${type}:${knowledgeNodeId ?? ""}`;
}

function defaultMinutes(type: StudyTaskType): number {
  return DEFAULT_MINUTES_BY_TYPE[type];
}

function severityRank(severity: string): number {
  if (severity === "high") {
    return 0;
  }

  return severity === "medium" ? 1 : 2;
}

/**
 * Builds today's candidate pool from system rules:
 * 1. unfinished tasks carried over from the most recent closed sheet;
 * 2. confirmed active weak points;
 * 3. uncorrected wrongbook items grouped by knowledge point;
 * 4. knowledge points currently being learned (unlocked + learning);
 * 5. new knowledge points (unlocked + not started) restricted to the current
 *    phase of the confirmed plan version when one exists.
 */
export function buildCandidates(
  inputs: GenerationInputs,
  excludeKeys: Set<string> = new Set()
): BuiltCandidates {
  const activeNodes = new Map<string, GenerationKnowledgeNode>(
    inputs.nodes.map((node) => [node.id, node])
  );

  const plan = inputs.confirmedPlan;
  let currentPhaseId: string | null = null;
  let currentPhaseTitle: string | null = null;
  let currentPhaseNodeIds: Set<string> | null = null;

  if (plan) {
    for (const phase of plan.phases) {
      const phaseNodeIds = phase.knowledgeNodeLinks
        .map((link) => link.knowledgeNodeId)
        .filter((nodeId) => activeNodes.has(nodeId));
      const hasUnmastered = phaseNodeIds.some(
        (nodeId) => activeNodes.get(nodeId)!.learningState !== "mastered"
      );

      if (hasUnmastered) {
        currentPhaseId = phase.id;
        currentPhaseTitle = phase.title;
        currentPhaseNodeIds = new Set(phaseNodeIds);
        break;
      }
    }
  }

  const phaseIdForNode = (nodeId: string | undefined): string | undefined =>
    nodeId && currentPhaseId && currentPhaseNodeIds?.has(nodeId)
      ? currentPhaseId
      : undefined;

  const seenKeys = new Set<string>(excludeKeys);
  const candidates: DailyTaskCandidate[] = [];
  const categoryCounts = new Map<StudyTaskSource, number>();

  const tryAdd = (
    candidate: Omit<DailyTaskCandidate, "candidateId">
  ): void => {
    const key = candidateDedupeKey(candidate.type, candidate.knowledgeNodeId);
    const used = categoryCounts.get(candidate.sourceType) ?? 0;

    if (seenKeys.has(key) || used >= CATEGORY_CAPS[candidate.sourceType]) {
      return;
    }

    seenKeys.add(key);
    categoryCounts.set(candidate.sourceType, used + 1);
    candidates.push({
      ...candidate,
      candidateId: `c${candidates.length + 1}`
    });
  };

  // 1. Carry over unfinished tasks from the most recent closed sheet.
  inputs.previousUnfinishedTasks.forEach((task, index) => {
    if (task.knowledgeNodeId && !activeNodes.has(task.knowledgeNodeId)) {
      return;
    }

    tryAdd({
      title: task.title,
      type: task.type,
      sourceType: "carry_over",
      knowledgeNodeId: task.knowledgeNodeId ?? undefined,
      materialId: task.materialId ?? undefined,
      planPhaseId: phaseIdForNode(task.knowledgeNodeId ?? undefined),
      carriedFromTaskId: task.id,
      estimatedMinutes: task.estimatedMinutes ?? defaultMinutes(task.type),
      priority: 100 + index,
      defaultReason: "昨日任务未完成，优先续排。",
      evidence: {
        rule: "carry_over",
        carriedFromTaskId: task.id,
        previousStatus: task.status
      }
    });
  });

  // 2. Active weak points need consolidation practice.
  [...inputs.weakPoints]
    .sort(
      (left, right) =>
        severityRank(left.severity) - severityRank(right.severity) ||
        left.id.localeCompare(right.id)
    )
    .forEach((weakPoint, index) => {
      const node = activeNodes.get(weakPoint.knowledgeNodeId);

      if (!node) {
        return;
      }

      tryAdd({
        title: `巩固薄弱点：${node.title}`,
        type: "practice_quiz",
        sourceType: "weak_point",
        knowledgeNodeId: node.id,
        planPhaseId: phaseIdForNode(node.id),
        estimatedMinutes: defaultMinutes("practice_quiz"),
        priority: 200 + index,
        defaultReason: `「${weakPoint.title}」是已确认的${
          weakPoint.severity === "high" ? "高" : weakPoint.severity === "medium" ? "中" : "低"
        }严重度薄弱点，建议做题巩固。`,
        evidence: {
          rule: "weak_point",
          weakPointId: weakPoint.id,
          severity: weakPoint.severity
        }
      });
    });

  // 3. Uncorrected wrongbook items grouped by knowledge point.
  const wrongbookGroups = new Map<string | null, number>();
  for (const group of inputs.wrongbookGroups) {
    const nodeId =
      group.knowledgeNodeId && activeNodes.has(group.knowledgeNodeId)
        ? group.knowledgeNodeId
        : null;
    wrongbookGroups.set(nodeId, (wrongbookGroups.get(nodeId) ?? 0) + group.count);
  }

  [...wrongbookGroups.entries()]
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .forEach(([nodeId, count], index) => {
      const node = nodeId ? activeNodes.get(nodeId) : undefined;

      tryAdd({
        title: node
          ? `复习错题：${node.title}（${count} 道）`
          : `复习未分类错题（${count} 道）`,
        type: "review_wrongbook",
        sourceType: "wrongbook",
        knowledgeNodeId: node?.id,
        planPhaseId: phaseIdForNode(node?.id),
        estimatedMinutes: defaultMinutes("review_wrongbook"),
        priority: 300 + index,
        defaultReason: `有 ${count} 道未订正错题，建议复习订正。`,
        evidence: {
          rule: "wrongbook",
          uncorrectedCount: count
        }
      });
    });

  // 4. Keep making progress on knowledge points already being learned.
  inputs.nodes
    .filter((node) => node.isUnlocked && node.learningState === "learning")
    .forEach((node, index) => {
      tryAdd({
        title: `继续学习：${node.title}`,
        type: "master_skill",
        sourceType: "plan",
        knowledgeNodeId: node.id,
        planPhaseId: phaseIdForNode(node.id),
        estimatedMinutes: defaultMinutes("master_skill"),
        priority: 400 + index,
        defaultReason: `「${node.title}」正在学习中（掌握度 ${node.mastery}%），建议继续推进。`,
        evidence: {
          rule: "learning_in_progress",
          mastery: node.mastery
        }
      });
    });

  // 5. New knowledge points, restricted to the current plan phase when present.
  const newNodePool = inputs.nodes.filter(
    (node) =>
      node.isUnlocked &&
      node.learningState === "not_started" &&
      (currentPhaseNodeIds ? currentPhaseNodeIds.has(node.id) : true)
  );

  newNodePool.forEach((node, index) => {
    tryAdd({
      title: `学习新知识点：${node.title}`,
      type: "master_skill",
      sourceType: "plan",
      knowledgeNodeId: node.id,
      planPhaseId: phaseIdForNode(node.id),
      estimatedMinutes: defaultMinutes("master_skill"),
      priority: 500 + index,
      defaultReason: currentPhaseTitle
        ? `属于当前阶段「${currentPhaseTitle}」且前置已就绪，可以开始学习。`
        : "前置知识已就绪，可以开始学习。",
      evidence: {
        rule: "new_in_current_phase",
        currentPhaseId
      }
    });
  });

  candidates.sort((left, right) => left.priority - right.priority);

  return {
    candidates: candidates.slice(0, MAX_CANDIDATES),
    planVersionId: plan?.id ?? null,
    currentPhaseId,
    currentPhaseTitle
  };
}

/** Deterministic fallback: schedule by rule priority within the time budget. */
export function selectByRules(
  candidates: DailyTaskCandidate[],
  availableMinutes: number
): SelectedDailyTask[] {
  const selection: SelectedDailyTask[] = [];
  let totalMinutes = 0;

  for (const candidate of candidates) {
    if (selection.length >= MAX_DAILY_TASKS) {
      break;
    }

    if (selection.length > 0 && totalMinutes >= availableMinutes) {
      break;
    }

    selection.push({
      candidate,
      reason: candidate.defaultReason
    });
    totalMinutes += candidate.estimatedMinutes;
  }

  return selection;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // The model may wrap JSON in prose or markdown fences; fall through.
  }

  const match = trimmed.match(/\{[\s\S]*\}/);

  if (!match) {
    return undefined;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return undefined;
  }
}

function buildAiPrompt(params: {
  project: GenerationProjectInfo;
  currentPhaseTitle: string | null;
  availableMinutes: number;
  candidates: DailyTaskCandidate[];
}): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    "你是一名学习规划助手，负责从候选学习任务中编排学生今天的任务清单。",
    "硬性规则：",
    "1. 只能从给出的候选任务中选择，禁止创造候选之外的任务。",
    `2. 最多选择 ${MAX_DAILY_TASKS} 个任务，至少选择 1 个。`,
    "3. 预计总时长应接近但尽量不超过可用时间预算。",
    "4. 未完成的续排任务和薄弱点巩固通常应优先安排。",
    "5. 为每个选中的任务写一句简短的中文理由。",
    '只输出一个 JSON 对象，格式：{"tasks":[{"candidateId":"c1","reason":"..."}],"note":"一句话整体说明（可选）"}。',
    "不要输出任何其他文字。"
  ].join("\n");

  const candidateLines = params.candidates.map((candidate) =>
    JSON.stringify({
      candidateId: candidate.candidateId,
      title: candidate.title,
      type: candidate.type,
      source: candidate.sourceType,
      estimatedMinutes: candidate.estimatedMinutes,
      ruleReason: candidate.defaultReason
    })
  );

  const userPrompt = [
    `学习项目：${params.project.title}（学科：${params.project.subject}）`,
    `学习目标：${params.project.goal || "未填写"}`,
    params.project.targetScore ? `目标分数：${params.project.targetScore}` : "",
    params.currentPhaseTitle ? `当前计划阶段：${params.currentPhaseTitle}` : "",
    `今日可用学习时间：${params.availableMinutes} 分钟`,
    "候选任务列表（每行一个 JSON）：",
    ...candidateLines
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, userPrompt };
}

function validateAiSelection(
  parsed: unknown,
  candidates: DailyTaskCandidate[],
  availableMinutes: number
): { selection: SelectedDailyTask[]; note?: string } | undefined {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const body = parsed as Record<string, unknown>;

  if (!Array.isArray(body.tasks)) {
    return undefined;
  }

  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const usedIds = new Set<string>();
  const selection: SelectedDailyTask[] = [];
  let totalMinutes = 0;

  for (const entry of body.tasks) {
    if (selection.length >= MAX_DAILY_TASKS) {
      break;
    }

    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const candidateId = (entry as Record<string, unknown>).candidateId;
    const reason = (entry as Record<string, unknown>).reason;

    if (typeof candidateId !== "string" || usedIds.has(candidateId)) {
      continue;
    }

    const candidate = candidateMap.get(candidateId);

    if (!candidate) {
      continue;
    }

    if (selection.length > 0 && totalMinutes >= availableMinutes) {
      break;
    }

    usedIds.add(candidateId);
    selection.push({
      candidate,
      reason:
        typeof reason === "string" && reason.trim()
          ? reason.trim().slice(0, 200)
          : candidate.defaultReason
    });
    totalMinutes += candidate.estimatedMinutes;
  }

  if (selection.length === 0) {
    return undefined;
  }

  return {
    selection,
    note: typeof body.note === "string" ? body.note.trim().slice(0, 300) : undefined
  };
}

/**
 * Deterministic rule-based daily task selection.
 * AI ranking stays behind FastAPI only; Express does not call LLM directly.
 */
export async function selectDailyTasks(params: {
  project: GenerationProjectInfo;
  candidates: DailyTaskCandidate[];
  currentPhaseTitle: string | null;
  availableMinutes: number;
}): Promise<{ selection: SelectedDailyTask[]; meta: SelectionMeta }> {
  const ruleSelection = selectByRules(params.candidates, params.availableMinutes);

  return {
    selection: ruleSelection,
    meta: { mode: "rules" }
  };
}

/** Compact, replayable record of one generation round for inputSnapshot. */
export function buildGenerationSnapshotEntry(params: {
  batch: number;
  generatedAt: Date;
  availableMinutes: number;
  built: BuiltCandidates;
  selection: SelectedDailyTask[];
  meta: SelectionMeta;
  trigger: "initial" | "regenerate";
}): Record<string, unknown> {
  return {
    batch: params.batch,
    trigger: params.trigger,
    generatedAt: params.generatedAt.toISOString(),
    availableMinutes: params.availableMinutes,
    planVersionId: params.built.planVersionId,
    currentPhaseId: params.built.currentPhaseId,
    currentPhaseTitle: params.built.currentPhaseTitle,
    candidates: params.built.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      title: candidate.title,
      type: candidate.type,
      sourceType: candidate.sourceType,
      knowledgeNodeId: candidate.knowledgeNodeId ?? null,
      priority: candidate.priority,
      estimatedMinutes: candidate.estimatedMinutes,
      evidence: candidate.evidence
    })),
    selection: {
      mode: params.meta.mode,
      provider: params.meta.provider,
      model: params.meta.model,
      aiNote: params.meta.aiNote,
      aiError: params.meta.aiError
    },
    selected: params.selection.map((item, index) => ({
      candidateId: item.candidate.candidateId,
      order: index,
      reason: item.reason
    }))
  };
}
