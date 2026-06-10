import { prisma } from "../lib/prisma";
import type {
  KnowledgeNode,
  KnowledgeNodeLearningState
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

const nodeInclude = {
  prerequisiteLinks: true
} satisfies KnowledgeNodeInclude;

export type KnowledgeNodeWithPrerequisites = KnowledgeNodeGetPayload<{
  include: typeof nodeInclude;
}>;

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

  async updateLearningStateByIdForProject(
    id: string,
    projectId: string,
    learningState: KnowledgeNodeLearningState
  ): Promise<KnowledgeNodeWithPrerequisites> {
    await prisma.knowledgeNode.update({
      where: {
        id,
        projectId
      },
      data: {
        learningState
      }
    });

    return this.findByIdForProject(id, projectId) as Promise<KnowledgeNodeWithPrerequisites>;
  },

  deleteByIdForProject(id: string, projectId: string): Promise<KnowledgeNode> {
    return prisma.knowledgeNode.delete({
      where: {
        id,
        projectId
      }
    });
  }
};
