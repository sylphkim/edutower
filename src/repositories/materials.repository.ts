import { prisma } from "../lib/prisma";
import type {
  Material,
  MaterialCategory,
  MaterialOrigin,
  MaterialStatus
} from "../generated/prisma/client";

export interface CreateMaterialRecordInput {
  userId: string;
  title: string;
  category: MaterialCategory;
  origin: MaterialOrigin;
  status: MaterialStatus;
  summary?: string;
}

export interface UpdateMaterialRecordInput {
  title?: string;
  category?: MaterialCategory;
  status?: MaterialStatus;
  summary?: string;
}

export const materialsRepository = {
  listByUser(userId: string): Promise<Material[]> {
    return prisma.material.findMany({
      where: {
        userId
      },
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ]
    });
  },

  findByIdForUser(id: string, userId: string): Promise<Material | null> {
    return prisma.material.findFirst({
      where: {
        id,
        userId
      }
    });
  },

  create(input: CreateMaterialRecordInput): Promise<Material> {
    return prisma.material.create({
      data: {
        userId: input.userId,
        title: input.title,
        category: input.category,
        origin: input.origin,
        status: input.status,
        summary: input.summary
      }
    });
  },

  updateByIdForUser(
    id: string,
    userId: string,
    input: UpdateMaterialRecordInput
  ): Promise<Material> {
    return prisma.material.update({
      where: {
        id,
        userId
      },
      data: input
    });
  },

  deleteById(id: string): Promise<Material> {
    return prisma.material.delete({
      where: {
        id
      }
    });
  }
};
