import { prisma } from "../lib/prisma";
import type {
  StudyPlanVersionGetPayload,
  StudyPlanVersionInclude
} from "../generated/prisma/models";
import type { PlanPhaseInput } from "../types/planVersion";

const versionInclude = {
  phases: {
    include: {
      knowledgeNodeLinks: {
        orderBy: [
          { order: "asc" },
          { createdAt: "asc" }
        ]
      }
    },
    orderBy: [
      { order: "asc" },
      { createdAt: "asc" }
    ]
  }
} satisfies StudyPlanVersionInclude;

const confirmVersionInclude = {
  phases: {
    include: {
      knowledgeNodeLinks: {
        include: {
          knowledgeNode: {
            select: {
              projectId: true,
              archivedAt: true
            }
          }
        },
        orderBy: [
          { order: "asc" },
          { createdAt: "asc" }
        ]
      }
    },
    orderBy: [
      { order: "asc" },
      { createdAt: "asc" }
    ]
  }
} satisfies StudyPlanVersionInclude;

export type PlanVersionWithPhases = StudyPlanVersionGetPayload<{
  include: typeof versionInclude;
}>;

type ConfirmablePlanVersion = StudyPlanVersionGetPayload<{
  include: typeof confirmVersionInclude;
}>;

export type ConfirmPlanVersionResult =
  | { status: "success" | "already_confirmed"; item: PlanVersionWithPhases }
  | { status: "not_found" | "superseded" | "incomplete" | "invalid_knowledge_nodes" };

export type RevisePlanVersionResult =
  | { status: "success"; item: PlanVersionWithPhases }
  | { status: "not_found" | "not_current" | "draft_exists" | "invalid_knowledge_nodes" };

function toPhaseCreateData(phases: PlanPhaseInput[]) {
  return phases.map((phase, phaseIndex) => ({
    title: phase.title,
    goal: phase.goal,
    description: phase.description,
    completionCriteria: phase.completionCriteria,
    order: phaseIndex,
    knowledgeNodeLinks: {
      create: phase.knowledgeNodeIds.map((knowledgeNodeId, knowledgeNodeIndex) => ({
        knowledgeNodeId,
        order: knowledgeNodeIndex
      }))
    }
  }));
}

function hasValidConfirmablePhases(item: ConfirmablePlanVersion): boolean {
  return (
    item.phases.length > 0 &&
    item.phases.every((phase) => phase.knowledgeNodeLinks.length > 0)
  );
}

function hasValidKnowledgeNodes(item: ConfirmablePlanVersion): boolean {
  return item.phases.every((phase) =>
    phase.knowledgeNodeLinks.every(
      (link) =>
        link.knowledgeNode.projectId === item.projectId &&
        link.knowledgeNode.archivedAt === null
    )
  );
}

export const planVersionsRepository = {
  findOwnedProject(projectId: string, userId: string): Promise<{ id: string } | null> {
    return prisma.studyProject.findFirst({
      where: {
        id: projectId,
        userId
      },
      select: {
        id: true
      }
    });
  },

  listByProject(projectId: string): Promise<PlanVersionWithPhases[]> {
    return prisma.studyPlanVersion.findMany({
      where: {
        projectId
      },
      include: versionInclude,
      orderBy: [
        { version: "desc" },
        { createdAt: "desc" }
      ]
    });
  },

  findByIdForProject(
    id: string,
    projectId: string
  ): Promise<PlanVersionWithPhases | null> {
    return prisma.studyPlanVersion.findFirst({
      where: {
        id,
        projectId
      },
      include: versionInclude
    });
  },

  findCurrentForProject(projectId: string): Promise<PlanVersionWithPhases | null> {
    return prisma.studyPlanVersion.findFirst({
      where: {
        projectId,
        status: "confirmed"
      },
      include: versionInclude,
      orderBy: [
        { version: "desc" },
        { confirmedAt: "desc" }
      ]
    });
  },

  countActiveKnowledgeNodesByIds(ids: string[], projectId: string): Promise<number> {
    if (ids.length === 0) {
      return Promise.resolve(0);
    }

    return prisma.knowledgeNode.count({
      where: {
        id: {
          in: ids
        },
        projectId,
        archivedAt: null
      }
    });
  },

  async createDraft(
    projectId: string,
    inputSnapshot: string,
    phases: PlanPhaseInput[]
  ): Promise<PlanVersionWithPhases> {
    const createdId = await prisma.$transaction(async (tx) => {
      const existingDraft = await tx.studyPlanVersion.findFirst({
        where: {
          projectId,
          status: "draft"
        },
        select: {
          id: true
        }
      });

      if (existingDraft) {
        return {
          status: "draft_exists" as const
        };
      }

      const latestVersion = await tx.studyPlanVersion.aggregate({
        where: {
          projectId
        },
        _max: {
          version: true
        }
      });
      const created = await tx.studyPlanVersion.create({
        data: {
          projectId,
          version: (latestVersion._max.version ?? 0) + 1,
          inputSnapshot,
          phases: {
            create: toPhaseCreateData(phases)
          }
        },
        select: {
          id: true
        }
      });

      return {
        status: "success" as const,
        id: created.id
      };
    });

    if (createdId.status === "draft_exists") {
      throw new PlanVersionRepositoryConflictError("draft_exists");
    }

    return this.findByIdForProject(createdId.id, projectId) as Promise<PlanVersionWithPhases>;
  },

  async replaceDraftPhases(
    id: string,
    projectId: string,
    phases: PlanPhaseInput[]
  ): Promise<
    | { status: "success"; item: PlanVersionWithPhases }
    | { status: "not_found" }
    | { status: "not_draft" }
  > {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.studyPlanVersion.findFirst({
        where: {
          id,
          projectId
        },
        select: {
          status: true
        }
      });

      if (!current) {
        return { status: "not_found" as const };
      }

      if (current.status !== "draft") {
        return { status: "not_draft" as const };
      }

      await tx.planPhase.deleteMany({
        where: {
          planVersionId: id
        }
      });

      await tx.studyPlanVersion.update({
        where: {
          id
        },
        data: {
          updatedAt: new Date(),
          ...(phases.length > 0
            ? {
                phases: {
                  create: toPhaseCreateData(phases)
                }
              }
            : {})
        }
      });

      return { status: "success" as const };
    });

    if (result.status !== "success") {
      return result;
    }

    return {
      status: "success",
      item: await this.findByIdForProject(id, projectId) as PlanVersionWithPhases
    };
  },

  async confirm(id: string, projectId: string): Promise<ConfirmPlanVersionResult> {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.studyPlanVersion.findFirst({
        where: {
          id,
          projectId
        },
        include: confirmVersionInclude
      });

      if (!current) {
        return { status: "not_found" as const };
      }

      if (current.status === "confirmed") {
        return { status: "already_confirmed" as const };
      }

      if (current.status === "superseded") {
        return { status: "superseded" as const };
      }

      if (!hasValidConfirmablePhases(current)) {
        return { status: "incomplete" as const };
      }

      if (!hasValidKnowledgeNodes(current)) {
        return { status: "invalid_knowledge_nodes" as const };
      }

      const now = new Date();
      await tx.studyPlanVersion.updateMany({
        where: {
          projectId,
          status: "confirmed",
          id: {
            not: id
          }
        },
        data: {
          status: "superseded",
          supersededAt: now
        }
      });
      await tx.studyPlanVersion.update({
        where: {
          id
        },
        data: {
          status: "confirmed",
          confirmedAt: now,
          supersededAt: null
        }
      });
      await tx.studyProject.update({
        where: {
          id: projectId
        },
        data: {
          status: "active",
          planConfirmedAt: now
        }
      });

      return { status: "success" as const };
    });

    if (result.status === "already_confirmed") {
      return {
        status: "already_confirmed",
        item: await this.findByIdForProject(id, projectId) as PlanVersionWithPhases
      };
    }

    if (result.status !== "success") {
      return result;
    }

    return {
      status: "success",
      item: await this.findByIdForProject(id, projectId) as PlanVersionWithPhases
    };
  },

  async revise(id: string, projectId: string): Promise<RevisePlanVersionResult> {
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.studyPlanVersion.findFirst({
        where: {
          id,
          projectId
        },
        include: confirmVersionInclude
      });

      if (!source) {
        return { status: "not_found" as const };
      }

      const currentConfirmed = await tx.studyPlanVersion.findFirst({
        where: {
          projectId,
          status: "confirmed"
        },
        select: {
          id: true
        },
        orderBy: [
          { version: "desc" },
          { confirmedAt: "desc" }
        ]
      });

      if (source.status !== "confirmed" || currentConfirmed?.id !== source.id) {
        return { status: "not_current" as const };
      }

      if (!hasValidKnowledgeNodes(source)) {
        return { status: "invalid_knowledge_nodes" as const };
      }

      const existingDraft = await tx.studyPlanVersion.findFirst({
        where: {
          projectId,
          status: "draft"
        },
        select: {
          id: true
        }
      });

      if (existingDraft) {
        return { status: "draft_exists" as const };
      }

      const latestVersion = await tx.studyPlanVersion.aggregate({
        where: {
          projectId
        },
        _max: {
          version: true
        }
      });
      const created = await tx.studyPlanVersion.create({
        data: {
          projectId,
          version: (latestVersion._max.version ?? 0) + 1,
          inputSnapshot: source.inputSnapshot,
          phases: {
            create: source.phases.map((phase) => ({
              title: phase.title,
              goal: phase.goal,
              description: phase.description,
              completionCriteria: phase.completionCriteria,
              order: phase.order,
              knowledgeNodeLinks: {
                create: phase.knowledgeNodeLinks.map((link) => ({
                  knowledgeNodeId: link.knowledgeNodeId,
                  order: link.order
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
        id: created.id
      };
    });

    if (result.status !== "success") {
      return result;
    }

    return {
      status: "success",
      item: await this.findByIdForProject(result.id, projectId) as PlanVersionWithPhases
    };
  }
};

export class PlanVersionRepositoryConflictError extends Error {
  constructor(public readonly reason: "draft_exists") {
    super(reason);
    this.name = "PlanVersionRepositoryConflictError";
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
