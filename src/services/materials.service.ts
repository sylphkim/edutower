import { mockMaterials } from "../mock/materials";
import type {
  CreateMaterialInput,
  MaterialItem,
  MaterialSource,
  MaterialStatus,
  MaterialType,
  UpdateMaterialInput
} from "../types/materials";
import { AppError } from "../utils/errors";

const VALID_TYPES: MaterialType[] = ["slides", "photo", "outline", "note", "other"];
const VALID_SOURCES: MaterialSource[] = ["uploaded", "manual", "mock"];
const VALID_STATUSES: MaterialStatus[] = ["pending", "processing", "ready", "failed"];

const materialItems: MaterialItem[] = mockMaterials.map((item) => ({ ...item }));
let nextMaterialNumber = materialItems.length + 1;

function createMaterialId(): string {
  const id = `mat-${String(nextMaterialNumber).padStart(3, "0")}`;
  nextMaterialNumber += 1;
  return id;
}

function findIndexById(id: string): number {
  const index = materialItems.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new AppError("INVALID_REQUEST", "Material item not found.", 404);
  }

  return index;
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
}

export const materialsService = {
  list(): { items: MaterialItem[] } {
    return {
      items: materialItems
    };
  },

  getById(id: string): MaterialItem {
    return materialItems[findIndexById(id)];
  },

  create(input: CreateMaterialInput): MaterialItem {
    ensureValidCreateInput(input);

    const now = new Date().toISOString();
    const item: MaterialItem = {
      id: createMaterialId(),
      title: input.title.trim(),
      type: input.type,
      source: input.source ?? "manual",
      status: "ready",
      summary: input.summary,
      createdAt: now,
      updatedAt: now
    };

    materialItems.push(item);
    return item;
  },

  update(id: string, input: UpdateMaterialInput): MaterialItem {
    ensureValidUpdateInput(input);

    const index = findIndexById(id);
    const currentItem = materialItems[index];
    const updatedItem: MaterialItem = {
      ...currentItem,
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      type: input.type ?? currentItem.type,
      status: input.status ?? currentItem.status,
      summary: input.summary ?? currentItem.summary,
      updatedAt: new Date().toISOString()
    };

    materialItems[index] = updatedItem;
    return updatedItem;
  },

  remove(id: string): MaterialItem {
    const index = findIndexById(id);
    const [removedItem] = materialItems.splice(index, 1);

    return removedItem;
  }
};
