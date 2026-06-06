import { prisma } from "../lib/prisma";
import type {
  KnowledgeNode,
  KnowledgeNodeStatus
} from "../generated/prisma/client";

export interface CreateKnowledgeNodeRecordInput {
  projectId: string;
  title: string;
  description?: string;
  parentId?: string;
  status: KnowledgeNodeStatus;
  mastery: number;
  order: number;
}

export interface UpdateKnowledgeNodeRecordInput {
  title?: string;
  description?: string;
  parentId?: string | null;
  status?: KnowledgeNodeStatus;
  mastery?: number;
  order?: number;
}

export const knowledgeNodesRepository = {
  listByProject(projectId: string): Promise<KnowledgeNode[]> {
    return prisma.knowledgeNode.findMany({
      where: {
        projectId
      },
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

  findByIdForProject(id: string, projectId: string): Promise<KnowledgeNode | null> {
    return prisma.knowledgeNode.findFirst({
      where: {
        id,
        projectId
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

  create(input: CreateKnowledgeNodeRecordInput): Promise<KnowledgeNode> {
    return prisma.knowledgeNode.create({
      data: input
    });
  },

  updateByIdForProject(
    id: string,
    projectId: string,
    input: UpdateKnowledgeNodeRecordInput
  ): Promise<KnowledgeNode> {
    return prisma.knowledgeNode.update({
      where: {
        id,
        projectId
      },
      data: input
    });
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
