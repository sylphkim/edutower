import { materialFoldersRepository } from "../repositories/materialFolders.repository";
import type { MaterialFolder } from "../generated/prisma/client";
import type {
  CreateMaterialFolderInput,
  MaterialFolderItem,
  UpdateMaterialFolderInput
} from "../types/materialFolders";
import { AppError } from "../utils/errors";
import { getDemoUserId } from "./demoUser.service";

function ensureMaterialFolderExists(item: MaterialFolder | null): MaterialFolder {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Material folder not found.", 404);
  }

  return item;
}

function ensureMaterialFolderOwnedByUser(item: MaterialFolder, userId: string): void {
  if (item.userId !== userId) {
    throw new AppError("INVALID_REQUEST", "Material folder not found.", 404);
  }
}

function normalizeFolderName(name: string): string {
  return name.trim().toLowerCase();
}

function readCreateFolderName(input: CreateMaterialFolderInput): string {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      "name is required and must be a non-empty string.",
      400
    );
  }

  return input.name.trim();
}

function readUpdateFolderName(input: UpdateMaterialFolderInput): string {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new AppError("INVALID_REQUEST", "name must be a non-empty string.", 400);
  }

  return input.name.trim();
}

function toApiMaterialFolder(item: MaterialFolder): MaterialFolderItem {
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

async function ensureUniqueFolderName(
  userId: string,
  normalizedName: string,
  currentFolderId?: string
): Promise<void> {
  const existingItem = await materialFoldersRepository.findByUserIdAndNormalizedName(
    userId,
    normalizedName
  );

  if (existingItem && existingItem.id !== currentFolderId) {
    throw new AppError(
      "INVALID_REQUEST",
      "A material folder with this name already exists.",
      409
    );
  }
}

export const materialFoldersService = {
  async list(): Promise<{ items: MaterialFolderItem[] }> {
    const userId = await getDemoUserId();
    const items = await materialFoldersRepository.listByUser(userId);

    return {
      items: items.map(toApiMaterialFolder)
    };
  },

  async create(input: CreateMaterialFolderInput): Promise<MaterialFolderItem> {
    const name = readCreateFolderName(input);
    const normalizedName = normalizeFolderName(name);
    const userId = await getDemoUserId();

    await ensureUniqueFolderName(userId, normalizedName);

    const item = await materialFoldersRepository.create({
      userId,
      name,
      normalizedName
    });

    return toApiMaterialFolder(item);
  },

  async update(
    id: string,
    input: UpdateMaterialFolderInput
  ): Promise<MaterialFolderItem> {
    const name = readUpdateFolderName(input);
    const normalizedName = normalizeFolderName(name);
    const userId = await getDemoUserId();
    const currentItem = ensureMaterialFolderExists(
      await materialFoldersRepository.findById(id)
    );

    ensureMaterialFolderOwnedByUser(currentItem, userId);
    await ensureUniqueFolderName(userId, normalizedName, currentItem.id);

    const updatedItem = await materialFoldersRepository.updateNameById(currentItem.id, {
      name,
      normalizedName
    });

    return toApiMaterialFolder(updatedItem);
  },

  async remove(id: string): Promise<MaterialFolderItem> {
    const userId = await getDemoUserId();
    const currentItem = ensureMaterialFolderExists(
      await materialFoldersRepository.findById(id)
    );

    ensureMaterialFolderOwnedByUser(currentItem, userId);

    const materialCount = await materialFoldersRepository.countMaterialsByFolderId(
      currentItem.id
    );

    if (materialCount > 0) {
      throw new AppError("INVALID_REQUEST", "Cannot delete a non-empty material folder.", 409);
    }

    const removedItem = await materialFoldersRepository.deleteById(currentItem.id);

    return toApiMaterialFolder(removedItem);
  }
};
