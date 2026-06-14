import { planProposalsRepository } from "../repositories/planProposals.repository";
import { planVersionsRepository } from "../repositories/planVersions.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import { projectsRepository } from "../repositories/projects.repository";
import type { ApplyPlanProposalResult, NormalizedPlanProposal } from "../types/planProposal";
import { AppError } from "../utils/errors";
import { getDemoUserId } from "./demoUser.service";
import { aiEngineService } from "./aiEngine.service";
import { hashPlanProposal, normalizePlanProposal } from "./planProposalValidation";
import { toPlanVersionItem } from "./planVersions.service";

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
  }
};

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
