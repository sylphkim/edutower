import { materialsRepository } from "../repositories/materials.repository";
import { materialFoldersRepository } from "../repositories/materialFolders.repository";
import type {
  Material,
  MaterialCategory,
  MaterialOrigin,
  MaterialStatus as PrismaMaterialStatus
} from "../generated/prisma/client";
import type {
  CreateMaterialInput,
  MaterialListQuery,
  MaterialItem,
  MaterialSource,
  MaterialStatus,
  MaterialType,
  UpdateMaterialInput
} from "../types/materials";
import { AppError } from "../utils/errors";
import { getDemoUserId } from "./demoUser.service";

const VALID_TYPES: MaterialType[] = ["slides", "photo", "outline", "note", "other"];
const VALID_SOURCES: MaterialSource[] = ["uploaded", "manual", "mock"];
const VALID_STATUSES: MaterialStatus[] = ["pending", "processing", "ready", "failed"];

function ensureMaterialExists(item: Material | null): Material {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Material item not found.", 404);
  }

  return item;
}

function ensureValidFolderId(value: unknown, fieldName: string): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      `${fieldName} must be a non-empty string or null.`,
      400
    );
  }
}

function normalizeListFolderId(folderId: string | null | undefined): string | null | undefined {
  if (folderId === "unclassified") {
    return null;
  }

  return folderId;
}

async function ensureFolderBelongsToUser(
  folderId: string,
  userId: string
): Promise<void> {
  const folder = await materialFoldersRepository.findById(folderId);

  if (!folder || folder.userId !== userId) {
    throw new AppError(
      "INVALID_REQUEST",
      "folderId must reference an existing material folder.",
      400
    );
  }
}

async function resolveFolderIdForUser(
  folderId: string | null | undefined,
  userId: string
): Promise<string | null | undefined> {
  if (folderId === undefined || folderId === null) {
    return folderId;
  }

  await ensureFolderBelongsToUser(folderId, userId);

  return folderId;
}

function ensureValidCreateInput(input: CreateMaterialInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
    throw new AppError("INVALID_REQUEST", "title is required and must be a non-empty string.", 400);
  }

  if (!VALID_TYPES.includes(input.type)) {
    throw new AppError("INVALID_REQUEST", `type must be one of: ${VALID_TYPES.join(", ")}.`, 400);
  }

  if (input.source !== undefined && !VALID_SOURCES.includes(input.source)) {
    throw new AppError(
      "INVALID_REQUEST",
      `source must be one of: ${VALID_SOURCES.join(", ")}.`,
      400
    );
  }

  if (input.summary !== undefined && typeof input.summary !== "string") {
    throw new AppError("INVALID_REQUEST", "summary must be a string.", 400);
  }

  ensureValidFolderId(input.folderId, "folderId");
}

function ensureValidUpdateInput(input: UpdateMaterialInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (
    input.title !== undefined &&
    (typeof input.title !== "string" || !input.title.trim())
  ) {
    throw new AppError("INVALID_REQUEST", "title must be a non-empty string.", 400);
  }

  if (input.type !== undefined && !VALID_TYPES.includes(input.type)) {
    throw new AppError("INVALID_REQUEST", `type must be one of: ${VALID_TYPES.join(", ")}.`, 400);
  }

  if (input.status !== undefined && !VALID_STATUSES.includes(input.status)) {
    throw new AppError(
      "INVALID_REQUEST",
      `status must be one of: ${VALID_STATUSES.join(", ")}.`,
      400
    );
  }

  if (input.summary !== undefined && typeof input.summary !== "string") {
    throw new AppError("INVALID_REQUEST", "summary must be a string.", 400);
  }

  ensureValidFolderId(input.folderId, "folderId");
}

function toMaterialCategory(type: MaterialType): MaterialCategory {
  return type as MaterialCategory;
}

function toMaterialOrigin(source: MaterialSource): MaterialOrigin {
  return source as MaterialOrigin;
}

function toMaterialStatus(status: MaterialStatus): PrismaMaterialStatus {
  return status as PrismaMaterialStatus;
}

function toApiMaterial(item: Material): MaterialItem {
  return {
    id: item.id,
    title: item.title,
    type: item.category as MaterialType,
    source: item.origin as MaterialSource,
    status: item.status as MaterialStatus,
    folderId: item.folderId,
    sourceType: item.sourceType,
    originalFileName: item.originalFileName,
    storedFileName: item.storedFileName,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    storagePath: item.storagePath,
    summary: item.summary ?? undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

export const materialsService = {
  async list(query: MaterialListQuery = {}): Promise<{ items: MaterialItem[] }> {
    ensureValidFolderId(query.folderId, "folderId");

    const userId = await getDemoUserId();
    const listFolderId = normalizeListFolderId(query.folderId);
    const folderId = await resolveFolderIdForUser(listFolderId, userId);
    const items = await materialsRepository.listByUser(userId, {
      folderId
    });

    return {
      items: items.map(toApiMaterial)
    };
  },

  async getById(id: string): Promise<MaterialItem> {
    const userId = await getDemoUserId();
    const item = ensureMaterialExists(await materialsRepository.findByIdForUser(id, userId));

    return toApiMaterial(item);
  },

  async create(input: CreateMaterialInput): Promise<MaterialItem> {
    ensureValidCreateInput(input);

    const userId = await getDemoUserId();
    const folderId = await resolveFolderIdForUser(input.folderId, userId);
    const item = await materialsRepository.create({
      userId,
      title: input.title.trim(),
      category: toMaterialCategory(input.type),
      origin: toMaterialOrigin(input.source ?? "manual"),
      status: toMaterialStatus("ready"),
      folderId: folderId ?? null,
      summary: input.summary
    });

    return toApiMaterial(item);
  },

  async update(id: string, input: UpdateMaterialInput): Promise<MaterialItem> {
    ensureValidUpdateInput(input);

    const userId = await getDemoUserId();
    const currentItem = ensureMaterialExists(
      await materialsRepository.findByIdForUser(id, userId)
    );
    const folderId = await resolveFolderIdForUser(input.folderId, userId);

    const updatedItem = await materialsRepository.updateByIdForUser(id, userId, {
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      category:
        input.type !== undefined ? toMaterialCategory(input.type) : currentItem.category,
      status:
        input.status !== undefined
          ? toMaterialStatus(input.status)
          : currentItem.status,
      ...(folderId !== undefined ? { folderId } : {}),
      summary: input.summary ?? currentItem.summary ?? undefined
    });

    return toApiMaterial(updatedItem);
  },

  async remove(id: string): Promise<MaterialItem> {
    const userId = await getDemoUserId();
    const currentItem = ensureMaterialExists(
      await materialsRepository.findByIdForUser(id, userId)
    );
    const removedItem = await materialsRepository.deleteById(currentItem.id);

    return toApiMaterial(removedItem);
  }
};
