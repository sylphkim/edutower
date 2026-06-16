import { planProposalsRepository } from "../repositories/planProposals.repository";
import { planVersionsRepository } from "../repositories/planVersions.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import { projectsRepository } from "../repositories/projects.repository";
import type { ApplyPlanProposalResult, NormalizedPlanProposal } from "../types/planProposal";
import type { PlanPhaseInput, PlanVersionItem } from "../types/planVersion";
import type { DailyStudyRecord } from "../types/dailyTasks";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { conceptMappingService } from "./conceptMapping.service";
import { getDemoUserId } from "./demo.service";
import { aiEngineService } from "./aiEngine.service";
import { hashPlanProposal, normalizePlanProposal } from "./planProposalValidation";
import { toPlanVersionItem, planVersionsService } from "./planVersions.service";
import { dailyTasksService } from "./dailyTasks.service";
import {
  PlanVersionRepositoryConflictError
} from "../repositories/planVersions.repository";

const DEMO_QUADRATIC_SKILL_PREFIX = "seed-skill-quadratic";

function goalLooksLikeCalculus(goal: string, subject: string): boolean {
  return /高数|高等数学|微积分|calculus/i.test(`${goal} ${subject}`);
}

function goalLooksLikeLinearAlgebra(goal: string, subject: string): boolean {
  return /线代|线性代数|矩阵|行列式/i.test(`${goal} ${subject}`);
}

/** Drop demo / cross-subject nodes that should not feed a newly designed plan. */
function filterNodesForGoalDesign(
  nodes: Array<{ id: string; title: string; description: string | null }>,
  goal: string,
  subject: string
): Array<{ id: string; title: string; description: string | null }> {
  let filtered = nodes;

  if (goalLooksLikeCalculus(goal, subject)) {
    filtered = filtered.filter((node) => !node.id.startsWith(DEMO_QUADRATIC_SKILL_PREFIX));

    if (!goalLooksLikeLinearAlgebra(goal, subject)) {
      filtered = filtered.filter(
        (node) => !/线性代数|行列式|高斯消元|矩阵运算|特征值|向量空间/.test(node.title)
      );
    }
  }

  return filtered;
}

function shouldReuseExistingNode(nodeId: string, goal: string, subject: string): boolean {
  if (nodeId.startsWith(DEMO_QUADRATIC_SKILL_PREFIX)) {
    return !goalLooksLikeCalculus(goal, subject);
  }

  return true;
}

function requiredProjectId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      "projectId is required and must be a non-empty string.",
      400
    );
  }

  return value.trim();
}

function isRetryableTransactionConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return new Set(["P2002", "P2034", "P1008"]).has(
    String((error as { code?: unknown }).code)
  );
}

async function buildResult(
  projectId: string,
  versionId: string,
  nodeKeyToId: Record<string, string>,
  nodeKeys: string[],
  idempotentReplay: boolean
): Promise<ApplyPlanProposalResult> {
  const planVersion = await planVersionsRepository.findByIdForProject(
    versionId,
    projectId
  );
  if (!planVersion) {
    throw new AppError("INTERNAL_ERROR", "Applied plan version could not be loaded.", 500);
  }

  return {
    planVersion: toPlanVersionItem(planVersion),
    knowledgeNodes: nodeKeys.map((key) => ({
      key,
      id: nodeKeyToId[key]
    })),
    idempotentReplay
  };
}

async function prelightTreeSafely(projectId: string, userId: string): Promise<void> {
  try {
    await conceptMappingService.prelightProjectTree(userId, projectId);
  } catch (error) {
    logger.warn("Failed to pre-light project tree from concept ledger.", error);
  }
}

export const planProposalsService = {
  async apply(projectId: unknown, input: unknown): Promise<ApplyPlanProposalResult> {
    const normalizedProjectId = requiredProjectId(projectId);
    const proposal = normalizePlanProposal(input);
    const contentHash = hashPlanProposal(proposal);
    const userId = await getDemoUserId();

    try {
      const result = await planProposalsRepository.apply(
        normalizedProjectId,
        userId,
        proposal,
        contentHash
      );

      switch (result.status) {
        case "success":
        case "replay":
          if (result.status === "success") {
            await prelightTreeSafely(normalizedProjectId, userId);
          }

          return buildResult(
            normalizedProjectId,
            result.versionId,
            result.nodeKeyToId,
            proposal.nodes.map((node) => node.key),
            result.status === "replay"
          );
        case "not_found":
          throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
        case "proposal_id_conflict":
          throw new AppError(
            "INVALID_REQUEST",
            "proposalId was already applied with different normalized content.",
            409
          );
        case "project_not_planning":
          throw new AppError(
            "INVALID_REQUEST",
            "Plan proposals can only initialize projects in planning status.",
            409
          );
        case "project_not_empty":
          throw new AppError(
            "INVALID_REQUEST",
            "Plan proposals can only initialize projects without knowledge nodes or plan versions.",
            409
          );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (!isRetryableTransactionConflict(error)) {
        throw error;
      }

      const replay = await planProposalsRepository.findReplay(
        normalizedProjectId,
        userId,
        proposal.proposalId
      );
      if (replay?.contentHash === contentHash) {
        return buildResult(
          normalizedProjectId,
          replay.versionId,
          replay.nodeKeyToId,
          proposal.nodes.map((node) => node.key),
          true
        );
      }

      throw new AppError(
        "INVALID_REQUEST",
        "The project was initialized by another proposal concurrently.",
        409
      );
    }
  },

  async generateFromAi(projectId: unknown): Promise<{ proposal: NormalizedPlanProposal; source: "ai" | "heuristic" }> {
    const normalizedProjectId = requiredProjectId(projectId);
    const userId = await getDemoUserId();
    const project = await projectsRepository.findByIdForUser(normalizedProjectId, userId);

    if (!project) {
      throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
    }

    const nodes = await knowledgeNodesRepository.listByProject(normalizedProjectId);
    const unlocked = nodes.filter((node) => node.isUnlocked && !node.archivedAt);

    if (!unlocked.length) {
      throw new AppError(
        "INVALID_REQUEST",
        "No unlocked skills available for plan generation.",
        409
      );
    }

    const skills = unlocked.map((node) => ({
      id: node.id,
      title: node.title,
      description: node.description,
      parentId: node.parentId
    }));

    const dependencyEdges = unlocked.flatMap((node) =>
      (node.prerequisiteLinks ?? []).map((link) => ({
        sourceId: link.prerequisiteId,
        targetId: node.id
      }))
    );

    const aiRaw = await aiEngineService.generatePlanProposal({
      goal: project.goal,
      skills,
      dependencyEdges
    });

    if (aiRaw) {
      return {
        proposal: normalizePlanProposal(aiRaw),
        source: "ai"
      };
    }

    const heuristic = buildHeuristicProposal(unlocked, dependencyEdges);
    return {
      proposal: normalizePlanProposal(heuristic),
      source: "heuristic"
    };
  },

  async designFromSettings(
    projectId: unknown
  ): Promise<{ proposal: NormalizedPlanProposal; source: "ai" | "heuristic" }> {
    const normalizedProjectId = requiredProjectId(projectId);
    const userId = await getDemoUserId();
    const project = await projectsRepository.findByIdForUser(normalizedProjectId, userId);

    if (!project) {
      throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
    }

    const goal = (project.goal ?? "").trim();
    if (!goal) {
      throw new AppError(
        "INVALID_REQUEST",
        "Learning goal is required before designing a plan.",
        400
      );
    }

    const existingNodes = await knowledgeNodesRepository.listByProject(normalizedProjectId);
    const activeNodes = existingNodes.filter((node) => !node.archivedAt);
    const designNodes = filterNodesForGoalDesign(
      activeNodes,
      goal,
      project.subject ?? project.title
    );

    const aiRaw = await aiEngineService.designLearningPlan({
      goal,
      subject: project.subject ?? project.title,
      deadline: project.deadline?.toISOString().slice(0, 10) ?? null,
      dailyMinutes: project.dailyMinutes,
      targetScore: project.targetScore,
      existingSkills: designNodes.map((node) => ({
        id: node.id,
        title: node.title,
        description: node.description
      }))
    });

    if (aiRaw) {
      return {
        proposal: normalizePlanProposal(aiRaw),
        source: "ai"
      };
    }

    return {
      proposal: normalizePlanProposal(
        buildHeuristicDesignedProposal(
          goal,
          project.subject ?? project.title,
          project.deadline?.toISOString().slice(0, 10) ?? null,
          project.dailyMinutes ?? 60,
          designNodes
        )
      ),
      source: "heuristic"
    };
  },

  async designApplyAndConfirm(
    projectId: unknown,
    options?: { force?: boolean }
  ): Promise<{
    proposal: NormalizedPlanProposal | null;
    source: "ai" | "heuristic" | "existing";
    planVersion: PlanVersionItem;
    dailyRecord: DailyStudyRecord;
  }> {
    const normalizedProjectId = requiredProjectId(projectId);
    const userId = await getDemoUserId();

    const currentConfirmed = await planVersionsRepository.findCurrentForProject(
      normalizedProjectId
    );
    if (currentConfirmed && !options?.force) {
      const { record } = await dailyTasksService.ensureToday(normalizedProjectId);
      return {
        proposal: null,
        source: "existing",
        planVersion: toPlanVersionItem(currentConfirmed),
        dailyRecord: record
      };
    }

    const { proposal, source } = await this.designFromSettings(normalizedProjectId);
    const project = await projectsRepository.findByIdForUser(normalizedProjectId, userId);
    if (!project) {
      throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
    }

    const { versionId } = await installDesignedPlan(
      normalizedProjectId,
      userId,
      proposal,
      project.goal ?? "",
      project.subject ?? project.title
    );
    const planVersion = await planVersionsService.confirm(normalizedProjectId, versionId);
    await prelightTreeSafely(normalizedProjectId, userId);

    await dailyTasksService.ensureToday(normalizedProjectId);
    let dailyRecord: DailyStudyRecord;
    try {
      dailyRecord = await dailyTasksService.regenerateToday(normalizedProjectId);
    } catch (error) {
      logger.warn("Failed to regenerate daily tasks after plan design.", error);
      dailyRecord = (await dailyTasksService.ensureToday(normalizedProjectId)).record;
    }

    return {
      proposal,
      source,
      planVersion,
      dailyRecord
    };
  }
};

async function materializeProposalSkills(
  projectId: string,
  proposal: NormalizedPlanProposal,
  goal: string,
  subject: string
): Promise<Record<string, string>> {
  const existingNodes = await knowledgeNodesRepository.listByProject(projectId);
  const titleToId = new Map<string, string>();

  for (const node of existingNodes) {
    if (!node.archivedAt) {
      titleToId.set(node.title.trim().toLowerCase(), node.id);
    }
  }

  const keyToId: Record<string, string> = {};
  const edgesByNode = new Map<string, string[]>();

  for (const edge of proposal.prerequisiteEdges) {
    const list = edgesByNode.get(edge.nodeKey) ?? [];
    list.push(edge.prerequisiteKey);
    edgesByNode.set(edge.nodeKey, list);
  }

  const pending = [...proposal.nodes];
  let safety = pending.length * pending.length + 1;

  while (pending.length > 0 && safety-- > 0) {
    const ready = pending.filter((node) => {
      const parentReady = !node.parentKey || Boolean(keyToId[node.parentKey]);
      const prereqs = edgesByNode.get(node.key) ?? [];
      return parentReady && prereqs.every((key) => Boolean(keyToId[key]));
    });

    const batch = ready.length > 0 ? ready : [pending[0]];

    for (const node of batch) {
      const titleKey = node.title.trim().toLowerCase();
      let id: string | undefined;

      const existingByTitle = existingNodes.find(
        (entry) => !entry.archivedAt && entry.title.trim().toLowerCase() === titleKey
      );
      if (
        existingByTitle &&
        shouldReuseExistingNode(existingByTitle.id, goal, subject)
      ) {
        id = existingByTitle.id;
      }

      if (!id) {
        const prereqIds = (edgesByNode.get(node.key) ?? [])
          .map((key) => keyToId[key])
          .filter((value): value is string => Boolean(value));

        const created = await knowledgeNodesRepository.create({
          projectId,
          title: node.title,
          description: node.description,
          parentId: node.parentKey ? keyToId[node.parentKey] : undefined,
          learningState: "not_started",
          mastery: 0,
          order: proposal.nodes.findIndex((entry) => entry.key === node.key),
          prerequisiteIds: prereqIds
        });
        id = created.id;
        titleToId.set(titleKey, id);
      }

      keyToId[node.key] = id;
    }

    for (const node of batch) {
      const index = pending.findIndex((entry) => entry.key === node.key);
      if (index >= 0) {
        pending.splice(index, 1);
      }
    }
  }

  return keyToId;
}

function proposalToPhases(
  proposal: NormalizedPlanProposal,
  nodeKeyToId: Record<string, string>
): PlanPhaseInput[] {
  return proposal.phases.map((phase) => ({
    title: phase.title,
    goal: phase.goal,
    description: phase.description,
    completionCriteria: phase.completionCriteria,
    knowledgeNodeIds: phase.nodeKeys
      .map((key) => nodeKeyToId[key])
      .filter((value): value is string => Boolean(value))
  }));
}

function buildDesignedInputSnapshot(
  project: {
    id: string;
    title: string;
    subject: string;
    goal: string | null;
    targetScore: string | null;
    startDate: Date | null;
    deadline: Date | null;
    dailyMinutes: number | null;
    updatedAt: Date;
  },
  proposal: NormalizedPlanProposal,
  contentHash: string,
  nodeKeyToId: Record<string, string>
): string {
  return JSON.stringify({
    project: {
      id: project.id,
      title: project.title,
      subject: project.subject,
      goal: project.goal,
      targetScore: project.targetScore,
      startDate: project.startDate,
      deadline: project.deadline,
      dailyMinutes: project.dailyMinutes,
      updatedAt: project.updatedAt
    },
    proposal: {
      id: proposal.proposalId,
      contentHash,
      nodeKeyToId
    }
  });
}

async function installDesignedPlan(
  projectId: string,
  userId: string,
  proposal: NormalizedPlanProposal,
  goal: string,
  subject: string
): Promise<{ versionId: string; nodeKeyToId: Record<string, string> }> {
  const project = await projectsRepository.findByIdForUser(projectId, userId);
  if (!project) {
    throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
  }

  const contentHash = hashPlanProposal(proposal);
  const nodeCount = await knowledgeNodesRepository.countByProject(projectId);
  const versions = await planVersionsRepository.listByProject(projectId);

  if (project.status === "planning" && nodeCount === 0 && versions.length === 0) {
    const result = await planProposalsRepository.apply(projectId, userId, proposal, contentHash);
    if (result.status === "success" || result.status === "replay") {
      return {
        versionId: result.versionId,
        nodeKeyToId: result.nodeKeyToId
      };
    }
  }

  const nodeKeyToId = await materializeProposalSkills(
    projectId,
    proposal,
    goal,
    subject
  );
  const keepNodeIds = [...new Set(Object.values(nodeKeyToId))];
  const archivedCount = await knowledgeNodesRepository.archiveExcept(projectId, keepNodeIds);
  if (archivedCount > 0) {
    logger.info(`Archived ${archivedCount} skill(s) outside the designed plan.`, {
      projectId
    });
  }

  const phases = proposalToPhases(proposal, nodeKeyToId);
  const inputSnapshot = buildDesignedInputSnapshot(project, proposal, contentHash, nodeKeyToId);

  const existingDraft = versions.find((version) => version.status === "draft");
  if (existingDraft) {
    const updated = await planVersionsRepository.replaceDraftPhases(
      existingDraft.id,
      projectId,
      phases
    );
    if (updated.status !== "success") {
      throw new AppError("INTERNAL_ERROR", "Failed to update existing draft plan.", 500);
    }

    return { versionId: existingDraft.id, nodeKeyToId };
  }

  try {
    const item = await planVersionsRepository.createDraft(projectId, inputSnapshot, phases);
    return { versionId: item.id, nodeKeyToId };
  } catch (error) {
    if (
      error instanceof PlanVersionRepositoryConflictError &&
      error.reason === "draft_exists"
    ) {
      const latestVersions = await planVersionsRepository.listByProject(projectId);
      const draft = latestVersions.find((version) => version.status === "draft");
      if (!draft) {
        throw error;
      }

      const updated = await planVersionsRepository.replaceDraftPhases(
        draft.id,
        projectId,
        phases
      );
      if (updated.status !== "success") {
        throw new AppError("INTERNAL_ERROR", "Failed to update existing draft plan.", 500);
      }

      return { versionId: draft.id, nodeKeyToId };
    }

    throw error;
  }
}

function buildCalculusSyllabus(): Array<{ key: string; title: string }> {
  return [
    { key: "node_limit", title: "极限与连续" },
    { key: "node_derivative", title: "导数与微分" },
    { key: "node_mean_value", title: "中值定理与导数应用" },
    { key: "node_indefinite_integral", title: "不定积分" },
    { key: "node_definite_integral", title: "定积分与应用" },
    { key: "node_improper_integral", title: "反常积分" }
  ];
}

function buildHeuristicDesignedProposal(
  goal: string,
  subject: string,
  deadline: string | null,
  dailyMinutes: number,
  existingNodes: Array<{ id: string; title: string; description: string | null }>
): unknown {
  const syllabus = goalLooksLikeCalculus(goal, subject)
    ? buildCalculusSyllabus()
    : [
        { key: "node_foundation", title: `${subject || "学科"}基础概念` },
        { key: "node_core_methods", title: `${subject || "学科"}核心方法` },
        { key: "node_practice", title: "综合练习" },
        { key: "node_review", title: "复习与冲刺" }
      ];

  const titleToExisting = new Map(
    existingNodes.map((node) => [node.title.trim().toLowerCase(), node])
  );

  const nodes = syllabus.map((topic) => {
    const matched = titleToExisting.get(topic.title.toLowerCase());
    if (matched) {
      const entry: Record<string, unknown> = {
        key: `node_${matched.id}`,
        title: matched.title
      };
      if (matched.description) {
        entry.description = matched.description;
      }
      return entry;
    }

    return topic;
  });

  const nodeKeys = nodes.map((node) => String((node as { key: string }).key));
  const prerequisiteEdges = nodeKeys.slice(1).map((nodeKey, index) => ({
    prerequisiteKey: nodeKeys[index],
    nodeKey
  }));

  const phaseCount = Math.min(3, Math.max(2, Math.ceil(nodeKeys.length / 3)));
  const chunkSize = Math.ceil(nodeKeys.length / phaseCount);
  const phases = [];

  for (let index = 0; index < phaseCount; index += 1) {
    const chunk = nodeKeys.slice(index * chunkSize, (index + 1) * chunkSize);
    if (!chunk.length) {
      continue;
    }

    phases.push({
      title: `第 ${index + 1} 阶段`,
      goal: `完成 ${chunk.length} 个知识点的学习与练习`,
      nodeKeys: chunk
    });
  }

  return {
    proposalId: `heuristic_design_${Date.now()}`,
    metadata: {
      provider: "express",
      model: "deadline-heuristic",
      generatedAt: new Date().toISOString()
    },
    nodes,
    prerequisiteEdges,
    phases
  };
}

function buildHeuristicProposal(
  unlocked: Array<{
    id: string;
    title: string;
    description: string | null;
    parentId: string | null;
  }>,
  dependencyEdges: Array<{ sourceId: string; targetId: string }>
): unknown {
  const nodes = unlocked.map((skill) => {
    const node: Record<string, unknown> = {
      key: `node_${skill.id}`,
      title: skill.title
    };
    if (skill.description) {
      node.description = skill.description;
    }
    if (skill.parentId) {
      node.parentKey = `node_${skill.parentId}`;
    }
    return node;
  });

  const phaseCount = Math.min(3, Math.max(1, Math.ceil(unlocked.length / 4)));
  const chunkSize = Math.ceil(unlocked.length / phaseCount);
  const phases = [];

  for (let index = 0; index < phaseCount; index += 1) {
    const chunk = unlocked.slice(index * chunkSize, (index + 1) * chunkSize);
    if (!chunk.length) {
      continue;
    }

    phases.push({
      title: `第 ${index + 1} 阶段`,
      goal: `掌握 ${chunk
        .slice(0, 3)
        .map((skill) => skill.title)
        .join("、")}${chunk.length > 3 ? " 等技能" : ""}`,
      nodeKeys: chunk.map((skill) => `node_${skill.id}`)
    });
  }

  return {
    proposalId: `heuristic_${Date.now()}`,
    metadata: {
      provider: "express",
      model: "skills-tree",
      generatedAt: new Date().toISOString()
    },
    nodes,
    prerequisiteEdges: dependencyEdges.map((edge) => ({
      prerequisiteKey: `node_${edge.sourceId}`,
      nodeKey: `node_${edge.targetId}`
    })),
    phases
  };
}
