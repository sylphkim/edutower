import { prisma } from "../lib/prisma";
import type { MaterialFolder } from "../generated/prisma/client";

export interface CreateMaterialFolderRecordInput {
  userId: string;
  name: string;
  normalizedName: string;
}

export interface UpdateMaterialFolderNameRecordInput {
  name: string;
  normalizedName: string;
}

export const materialFoldersRepository = {
  listByUser(userId: string): Promise<MaterialFolder[]> {
    return prisma.materialFolder.findMany({
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

  findById(id: string): Promise<MaterialFolder | null> {
    return prisma.materialFolder.findUnique({
      where: {
        id
      }
    });
  },

  findByUserIdAndNormalizedName(
    userId: string,
    normalizedName: string
  ): Promise<MaterialFolder | null> {
    return prisma.materialFolder.findUnique({
      where: {
        userId_normalizedName: {
          userId,
          normalizedName
        }
      }
    });
  },

  create(input: CreateMaterialFolderRecordInput): Promise<MaterialFolder> {
    return prisma.materialFolder.create({
      data: {
        userId: input.userId,
        name: input.name,
        normalizedName: input.normalizedName
      }
    });
  },

  updateNameById(
    id: string,
    input: UpdateMaterialFolderNameRecordInput
  ): Promise<MaterialFolder> {
    return prisma.materialFolder.update({
      where: {
        id
      },
      data: {
        name: input.name,
        normalizedName: input.normalizedName
      }
    });
  },

  deleteById(id: string): Promise<MaterialFolder> {
    return prisma.materialFolder.delete({
      where: {
        id
      }
    });
  },

  countMaterialsByFolderId(folderId: string): Promise<number> {
    return prisma.material.count({
      where: {
        folderId
      }
    });
  }
};
