import { prisma } from "../lib/prisma";
import type {
  KnowledgeNode,
  KnowledgeNodeLearningState,
  Prisma
} from "../generated/prisma/client";
import type {
  KnowledgeNodeGetPayload,
  KnowledgeNodeInclude
} from "../generated/prisma/models";

export interface CreateKnowledgeNodeRecordInput {
  projectId: string;
  title: string;
  description?: string;
  parentId?: string;
  learningState: KnowledgeNodeLearningState;
  mastery: number;
  order: number;
  prerequisiteIds: string[];
}

export interface UpdateKnowledgeNodeRecordInput {
  title?: string;
  description?: string;
  parentId?: string | null;
  learningState?: KnowledgeNodeLearningState;
  mastery?: number;
  order?: number;
  prerequisiteIds?: string[];
}

export interface PrelightNodeUpdate {
  nodeId: string;
  learningState: KnowledgeNodeLearningState;
  mastery: number;
  isUnlocked: boolean;
}

const nodeInclude = {
  prerequisiteLinks: true
} satisfies KnowledgeNodeInclude;

export type KnowledgeNodeWithPrerequisites = KnowledgeNodeGetPayload<{
  include: typeof nodeInclude;
}>;

export type UpdateLearningStateAndUnlockDependentsResult =
  | {
      status: "success";
      item: KnowledgeNodeWithPrerequisites;
    }
  | {
      status: "not_found" | "archived" | "locked";
    };

/**
 * Applies a learning state change inside an existing transaction and unlocks
 * direct dependents whose prerequisites are now all mastered. Shared between
 * the skills PATCH endpoint and daily summary suggestion decisions so both
 * paths enforce identical unlock rules.
 */
export async function applyLearningStateChangeWithinTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  projectId: string,
  learningState: KnowledgeNodeLearningState
): Promise<UpdateLearningStateAndUnlockDependentsResult> {
  const currentItem = await tx.knowledgeNode.findFirst({
    where: {
      id,
      projectId
    },
    include: nodeInclude
  });

  if (!currentItem) {
    return {
      status: "not_found"
    };
  }

  if (currentItem.archivedAt) {
    return {
      status: "archived"
    };
  }

  if (!currentItem.isUnlocked) {
    if (currentItem.learningState === learningState) {
      return {
        status: "success",
        item: currentItem
      };
    }

    return {
      status: "locked"
    };
  }

  if (currentItem.learningState === learningState) {
    return {
      status: "success",
      item: currentItem
    };
  }

  await tx.knowledgeNode.update({
    where: {
      id,
      projectId
    },
    data: {
      learningState
    }
  });

  if (learningState === "mastered" && currentItem.learningState !== "mastered") {
    const directDependents = await tx.knowledgeNode.findMany({
      where: {
        projectId,
        archivedAt: null,
        isUnlocked: false,
        prerequisiteLinks: {
          some: {
            prerequisiteId: id
          }
        }
      },
      include: {
        prerequisiteLinks: {
          include: {
            prerequisite: {
              select: {
                learningState: true
              }
            }
          }
        }
      }
    });
    const unlockableDependentIds = directDependents
      .filter((dependent) =>
        dependent.prerequisiteLinks.every(
          (link) => link.prerequisite.learningState === "mastered"
        )
      )
      .map((dependent) => dependent.id);

    if (unlockableDependentIds.length > 0) {
      await tx.knowledgeNode.updateMany({
        where: {
          id: {
            in: unlockableDependentIds
          },
          projectId,
          archivedAt: null,
          isUnlocked: false
        },
        data: {
          isUnlocked: true,
          unlockedAt: new Date()
        }
      });
    }
  }

  const updatedItem = await tx.knowledgeNode.findFirst({
    where: {
      id,
      projectId
    },
    include: nodeInclude
  });

  return {
    status: "success",
    item: updatedItem as KnowledgeNodeWithPrerequisites
  };
}

export const knowledgeNodesRepository = {
  listByProject(projectId: string): Promise<KnowledgeNodeWithPrerequisites[]> {
    return prisma.knowledgeNode.findMany({
      where: {
        projectId
      },
      include: nodeInclude,
      orderBy: [
        {
          order: "asc"
        },
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ]
    });
  },

  listTreeByProject(
    projectId: string,
    includeArchived: boolean
  ): Promise<KnowledgeNodeWithPrerequisites[]> {
    return prisma.knowledgeNode.findMany({
      where: {
        projectId,
        ...(includeArchived
          ? {}
          : {
              archivedAt: null
            })
      },
      include: nodeInclude,
      orderBy: [
        {
          order: "asc"
        },
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ]
    });
  },

  findByIdForProject(
    id: string,
    projectId: string
  ): Promise<KnowledgeNodeWithPrerequisites | null> {
    return prisma.knowledgeNode.findFirst({
      where: {
        id,
        projectId
      },
      include: nodeInclude
    });
  },

  async countByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    return prisma.knowledgeNode.count({
      where: {
        id: {
          in: ids
        }
      }
    });
  },

  async countByIdsForProject(ids: string[], projectId: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    return prisma.knowledgeNode.count({
      where: {
        id: {
          in: ids
        },
        projectId
      }
    });
  },

  countByProject(projectId: string): Promise<number> {
    return prisma.knowledgeNode.count({
      where: {
        projectId
      }
    });
  },

  async create(input: CreateKnowledgeNodeRecordInput): Promise<KnowledgeNodeWithPrerequisites> {
    const item = await prisma.$transaction(async (tx) => {
      const createdItem = await tx.knowledgeNode.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          parentId: input.parentId,
          learningState: input.learningState,
          mastery: input.mastery,
          order: input.order
        }
      });

      if (input.prerequisiteIds.length > 0) {
        await tx.knowledgeNodePrerequisite.createMany({
          data: input.prerequisiteIds.map((prerequisiteId) => ({
            nodeId: createdItem.id,
            prerequisiteId
          }))
        });

        // 有前置依赖：检查是否全部已 mastered，是则自动解锁
        const masteredCount = await tx.knowledgeNode.count({
          where: {
            id: { in: input.prerequisiteIds },
            projectId: input.projectId,
            learningState: "mastered"
          }
        });
        if (masteredCount === input.prerequisiteIds.length) {
          await tx.knowledgeNode.update({
            where: { id: createdItem.id },
            data: { isUnlocked: true, unlockedAt: new Date() }
          });
        }
      } else {
        // 无前置依赖 → 自动解锁
        await tx.knowledgeNode.update({
          where: { id: createdItem.id },
          data: { isUnlocked: true, unlockedAt: new Date() }
        });
      }

      return createdItem;
    });

    return this.findByIdForProject(
      item.id,
      input.projectId
    ) as Promise<KnowledgeNodeWithPrerequisites>;
  },

  async updateByIdForProject(
    id: string,
    projectId: string,
    input: UpdateKnowledgeNodeRecordInput
  ): Promise<KnowledgeNodeWithPrerequisites> {
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeNode.update({
        where: {
          id,
          projectId
        },
        data: {
          title: input.title,
          description: input.description,
          parentId: input.parentId,
          learningState: input.learningState,
          mastery: input.mastery,
          order: input.order
        }
      });

      if (input.prerequisiteIds !== undefined) {
        await tx.knowledgeNodePrerequisite.deleteMany({
          where: {
            nodeId: id
          }
        });

        if (input.prerequisiteIds.length > 0) {
          await tx.knowledgeNodePrerequisite.createMany({
            data: input.prerequisiteIds.map((prerequisiteId) => ({
              nodeId: id,
              prerequisiteId
            }))
          });
        }
      }
    });

    return this.findByIdForProject(id, projectId) as Promise<KnowledgeNodeWithPrerequisites>;
  },

  async updateLearningStateAndUnlockDirectDependentsByIdForProject(
    id: string,
    projectId: string,
    learningState: KnowledgeNodeLearningState
  ): Promise<UpdateLearningStateAndUnlockDependentsResult> {
    return prisma.$transaction((tx) =>
      applyLearningStateChangeWithinTransaction(tx, id, projectId, learningState)
    );
  },

  deleteByIdForProject(id: string, projectId: string): Promise<KnowledgeNode> {
    return prisma.knowledgeNode.delete({
      where: {
        id,
        projectId
      }
    });
  },

  /**
   * 概念账本「预点亮」：把命中账本的节点设为对应状态/掌握度并解锁，
   * 再把「前置已全部 mastered」的锁定节点一并解锁（解锁不触发掌握，单趟即可）。
   */
  async prelightNodes(projectId: string, updates: PrelightNodeUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      for (const update of updates) {
        await tx.knowledgeNode.update({
          where: {
            id: update.nodeId,
            projectId
          },
          data: {
            learningState: update.learningState,
            mastery: update.mastery,
            isUnlocked: update.isUnlocked,
            unlockedAt: update.isUnlocked ? now : undefined
          }
        });
      }

      const locked = await tx.knowledgeNode.findMany({
        where: {
          projectId,
          archivedAt: null,
          isUnlocked: false
        },
        include: {
          prerequisiteLinks: {
            include: {
              prerequisite: {
                select: {
                  learningState: true
                }
              }
            }
          }
        }
      });
      const unlockableIds = locked
        .filter(
          (node) =>
            node.prerequisiteLinks.length > 0 &&
            node.prerequisiteLinks.every(
              (link) => link.prerequisite.learningState === "mastered"
            )
        )
        .map((node) => node.id);

      if (unlockableIds.length > 0) {
        await tx.knowledgeNode.updateMany({
          where: {
            id: { in: unlockableIds },
            projectId,
            archivedAt: null,
            isUnlocked: false
          },
          data: {
            isUnlocked: true,
            unlockedAt: now
          }
        });
      }
    });
  }
};
