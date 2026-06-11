import { prisma } from "../lib/prisma";
import type { NormalizedPlanProposal } from "../types/planProposal";

interface StoredProposalIdentity {
  proposalId: string;
  contentHash: string;
  nodeKeyToId: Record<string, string>;
}

export type ApplyProposalRepositoryResult =
  | {
      status: "success" | "replay";
      versionId: string;
      nodeKeyToId: Record<string, string>;
    }
  | {
      status:
        | "not_found"
        | "proposal_id_conflict"
        | "project_not_planning"
        | "project_not_empty";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredProposal(inputSnapshot: string): StoredProposalIdentity | null {
  try {
    const snapshot = JSON.parse(inputSnapshot) as unknown;
    if (!isRecord(snapshot) || !isRecord(snapshot.proposal)) {
      return null;
    }

    const proposal = snapshot.proposal;
    if (
      typeof proposal.id !== "string" ||
      typeof proposal.contentHash !== "string" ||
      !isRecord(proposal.nodeKeyToId) ||
      !Object.values(proposal.nodeKeyToId).every((value) => typeof value === "string")
    ) {
      return null;
    }

    return {
      proposalId: proposal.id,
      contentHash: proposal.contentHash,
      nodeKeyToId: proposal.nodeKeyToId as Record<string, string>
    };
  } catch {
    return null;
  }
}

function findMatchingStoredProposal(
  versions: Array<{ id: string; inputSnapshot: string }>,
  proposalId: string
): { versionId: string; identity: StoredProposalIdentity } | null {
  for (const version of versions) {
    const identity = readStoredProposal(version.inputSnapshot);
    if (identity?.proposalId === proposalId) {
      return {
        versionId: version.id,
        identity
      };
    }
  }

  return null;
}

export const planProposalsRepository = {
  async findReplay(
    projectId: string,
    userId: string,
    proposalId: string
  ): Promise<{
    versionId: string;
    contentHash: string;
    nodeKeyToId: Record<string, string>;
  } | null> {
    const versions = await prisma.studyPlanVersion.findMany({
      where: {
        projectId,
        project: {
          userId
        }
      },
      select: {
        id: true,
        inputSnapshot: true
      },
      orderBy: {
        version: "asc"
      }
    });
    const match = findMatchingStoredProposal(versions, proposalId);

    return match
      ? {
          versionId: match.versionId,
          contentHash: match.identity.contentHash,
          nodeKeyToId: match.identity.nodeKeyToId
        }
      : null;
  },

  apply(
    projectId: string,
    userId: string,
    proposal: NormalizedPlanProposal,
    contentHash: string
  ): Promise<ApplyProposalRepositoryResult> {
    return prisma.$transaction(async (tx) => {
      const project = await tx.studyProject.findFirst({
        where: {
          id: projectId,
          userId
        },
        select: {
          id: true,
          title: true,
          subject: true,
          goal: true,
          targetScore: true,
          startDate: true,
          deadline: true,
          dailyMinutes: true,
          status: true,
          updatedAt: true,
          materialLinks: {
            select: {
              material: {
                select: {
                  id: true,
                  title: true,
                  category: true,
                  sourceType: true,
                  status: true,
                  summary: true,
                  updatedAt: true
                }
              }
            },
            orderBy: [
              { createdAt: "asc" },
              { materialId: "asc" }
            ]
          }
        }
      });

      if (!project) {
        return { status: "not_found" as const };
      }

      const existingVersions = await tx.studyPlanVersion.findMany({
        where: {
          projectId
        },
        select: {
          id: true,
          inputSnapshot: true
        },
        orderBy: {
          version: "asc"
        }
      });
      const replay = findMatchingStoredProposal(existingVersions, proposal.proposalId);
      if (replay) {
        if (replay.identity.contentHash !== contentHash) {
          return { status: "proposal_id_conflict" as const };
        }

        return {
          status: "replay" as const,
          versionId: replay.versionId,
          nodeKeyToId: replay.identity.nodeKeyToId
        };
      }

      if (project.status !== "planning") {
        return { status: "project_not_planning" as const };
      }

      const knowledgeNodeCount = await tx.knowledgeNode.count({ where: { projectId } });
      if (knowledgeNodeCount > 0 || existingVersions.length > 0) {
        return { status: "project_not_empty" as const };
      }

      const now = new Date();
      const dependentKeys = new Set(
        proposal.prerequisiteEdges.map((edge) => edge.nodeKey)
      );
      const nodeKeyToId: Record<string, string> = {};

      for (const [order, node] of proposal.nodes.entries()) {
        const isUnlocked = !dependentKeys.has(node.key);
        const created = await tx.knowledgeNode.create({
          data: {
            projectId,
            title: node.title,
            description: node.description,
            order,
            learningState: "not_started",
            mastery: 0,
            isUnlocked,
            unlockedAt: isUnlocked ? now : null
          },
          select: {
            id: true
          }
        });
        nodeKeyToId[node.key] = created.id;
      }

      for (const node of proposal.nodes) {
        if (node.parentKey) {
          await tx.knowledgeNode.update({
            where: {
              id: nodeKeyToId[node.key]
            },
            data: {
              parentId: nodeKeyToId[node.parentKey]
            }
          });
        }
      }

      if (proposal.prerequisiteEdges.length > 0) {
        await tx.knowledgeNodePrerequisite.createMany({
          data: proposal.prerequisiteEdges.map((edge) => ({
            prerequisiteId: nodeKeyToId[edge.prerequisiteKey],
            nodeId: nodeKeyToId[edge.nodeKey]
          }))
        });
      }

      const inputSnapshot = JSON.stringify({
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
        materials: project.materialLinks.map((link) => ({
          id: link.material.id,
          title: link.material.title,
          category: link.material.category,
          sourceType: link.material.sourceType,
          status: link.material.status,
          summary: link.material.summary,
          updatedAt: link.material.updatedAt
        })),
        proposal: {
          id: proposal.proposalId,
          contentHash,
          metadata: proposal.metadata,
          appliedAt: now,
          nodeKeyToId
        }
      });
      const version = await tx.studyPlanVersion.create({
        data: {
          projectId,
          version: 1,
          status: "draft",
          inputSnapshot,
          phases: {
            create: proposal.phases.map((phase, phaseIndex) => ({
              title: phase.title,
              goal: phase.goal,
              description: phase.description,
              completionCriteria: phase.completionCriteria,
              order: phaseIndex,
              knowledgeNodeLinks: {
                create: phase.nodeKeys.map((nodeKey, nodeIndex) => ({
                  knowledgeNodeId: nodeKeyToId[nodeKey],
                  order: nodeIndex
                }))
              }
            }))
          }
        },
        select: {
          id: true
        }
      });

      return {
        status: "success" as const,
        versionId: version.id,
        nodeKeyToId
      };
    });
  }
};
