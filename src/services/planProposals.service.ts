import { planProposalsRepository } from "../repositories/planProposals.repository";
import { planVersionsRepository } from "../repositories/planVersions.repository";
import type { ApplyPlanProposalResult } from "../types/planProposal";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
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
  }
};
