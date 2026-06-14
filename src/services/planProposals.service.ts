import { randomUUID } from "node:crypto";
import { materialsRepository } from "../repositories/materials.repository";
import { planProposalsRepository } from "../repositories/planProposals.repository";
import { planVersionsRepository } from "../repositories/planVersions.repository";
import { projectsRepository } from "../repositories/projects.repository";
import type { ApplyPlanProposalResult, NormalizedPlanProposal } from "../types/planProposal";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { aiEngineService } from "./aiEngine.service";
import { conceptsService } from "./concepts.service";
import { conceptMappingService } from "./conceptMapping.service";
import { getDemoUserId } from "./demo.service";
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

  /**
   * 让 FastAPI 起草一份计划 proposal（编排：收集项目上下文 → 调 AI → 过同一套校验）。
   * Express 不直连 LLM；FastAPI 不可达直接抛 502。返回的是【未应用】的草稿，
   * 供前端预览/微调后再走 apply。AI 输出非法会被 normalizePlanProposal 挡下并转成 502。
   */
  async generate(projectId: unknown): Promise<NormalizedPlanProposal> {
    const normalizedProjectId = requiredProjectId(projectId);
    const userId = await getDemoUserId();

    const project = await projectsRepository.findSetupByIdForUser(normalizedProjectId, userId);
    if (!project) {
      throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
    }

    const [materials, conceptList] = await Promise.all([
      materialsRepository.listByProjectForUser(normalizedProjectId, userId),
      conceptsService.listGlobal()
    ]);

    const draft = await aiEngineService.generatePlan({
      project: {
        title: project.title,
        subject: project.subject,
        goal: project.goal,
        targetScore: project.targetScore ?? null,
        deadline: project.deadline ? project.deadline.toISOString() : null,
        dailyMinutes: project.dailyMinutes ?? null
      },
      materials: materials.map((material) => ({
        title: material.title,
        summary: material.summary ?? ""
      })),
      masteredConcepts: conceptList.concepts
        .filter((concept) => concept.state === "mastered")
        .map((concept) => ({ name: concept.name, subject: concept.subject }))
    });

    try {
      return normalizePlanProposal({
        proposalId: `ai_${randomUUID()}`,
        metadata: {
          provider: "fastapi",
          generatedAt: new Date().toISOString()
        },
        nodes: draft.nodes,
        prerequisiteEdges: draft.prerequisiteEdges,
        phases: draft.phases
      });
    } catch (error) {
      if (error instanceof AppError && error.code === "INVALID_REQUEST") {
        throw new AppError(
          "AI_ENGINE_REQUEST_FAILED",
          `AI 生成的计划结构不合法：${error.message}`,
          502,
          error
        );
      }
      throw error;
    }
  }
};
