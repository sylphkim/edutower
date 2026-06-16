import { prisma } from "../lib/prisma";
import type {
  Material,
  MaterialCategory,
  MaterialOrigin,
  MaterialSourceType,
  MaterialStatus
} from "../generated/prisma/client";

export interface ListMaterialsByUserOptions {
  folderId?: string | null;
}

export interface CreateMaterialRecordInput {
  userId: string;
  title: string;
  category: MaterialCategory;
  origin: MaterialOrigin;
  status: MaterialStatus;
  folderId?: string | null;
  sourceType?: MaterialSourceType | null;
  originalFileName?: string | null;
  storedFileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
  summary?: string;
  extractedText?: string | null;
}

export interface UpdateMaterialRecordInput {
  title?: string;
  category?: MaterialCategory;
  status?: MaterialStatus;
  folderId?: string | null;
  summary?: string;
  extractedText?: string | null;
}

export const materialsRepository = {
  listByUser(
    userId: string,
    options: ListMaterialsByUserOptions = {}
  ): Promise<Material[]> {
    const { folderId } = options;

    return prisma.material.findMany({
      where: {
        userId,
        ...(folderId !== undefined ? { folderId } : {})
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

  // 某项目关联的资料（经 ProjectMaterial 关联）。
  listByProjectForUser(projectId: string, userId: string): Promise<Material[]> {
    return prisma.material.findMany({
      where: {
        userId,
        projectLinks: {
          some: {
            projectId
          }
        }
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

  create(input: CreateMaterialRecordInput): Promise<Material> {
    return prisma.material.create({
      data: {
        userId: input.userId,
        title: input.title,
        category: input.category,
        origin: input.origin,
        status: input.status,
        folderId: input.folderId ?? null,
        sourceType: input.sourceType,
        originalFileName: input.originalFileName,
        storedFileName: input.storedFileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        summary: input.summary,
        extractedText: input.extractedText ?? null
      }
    });
  },

  updateByIdForUser(
    id: string,
    userId: string,
    input: UpdateMaterialRecordInput
  ): Promise<Material> {
    const { folderId, ...data } = input;

    return prisma.material.update({
      where: {
        id,
        userId
      },
      data: {
        ...data,
        ...(folderId !== undefined ? { folderId } : {})
      }
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
