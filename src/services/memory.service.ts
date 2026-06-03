import { mockMemoryItems } from "../mock/memory";
import type {
  CreateMemoryInput,
  DailySummaryInput,
  MemoryImportance,
  MemoryItem,
  MemoryType,
  UpdateMemoryInput
} from "../types/memory";
import { AppError } from "../utils/errors";

const VALID_MEMORY_TYPES: MemoryType[] = [
  "weakness",
  "daily_summary",
  "progress",
  "preference",
  "note"
];
const VALID_IMPORTANCE: MemoryImportance[] = ["low", "medium", "high"];

// 先用内存数组保存长期记忆，以后可以替换成数据库查询。
const memoryItems: MemoryItem[] = mockMemoryItems.map((item) => ({
  ...item,
  relatedMaterialIds: [...item.relatedMaterialIds],
  relatedSkillIds: [...item.relatedSkillIds],
  relatedQuizIds: [...item.relatedQuizIds],
  relatedWrongbookIds: [...item.relatedWrongbookIds]
}));
let nextMemoryNumber = memoryItems.length + 1;

function createMemoryId(): string {
  const id = `mem-${String(nextMemoryNumber).padStart(3, "0")}`;
  nextMemoryNumber += 1;
  return id;
}

// 找不到 id 时直接抛错，避免调用方静默失败。
function findIndexById(id: string): number {
  const index = memoryItems.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new AppError("INVALID_REQUEST", "Memory item not found.", 404);
  }

  return index;
}

function ensureStringArray(value: string[], fieldName: string): void {
  if (!Array.isArray(value)) {
    throw new AppError("INVALID_REQUEST", `${fieldName} must be an array.`, 400);
  }

  if (value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new AppError("INVALID_REQUEST", `${fieldName} must contain non-empty strings.`, 400);
  }
}

function ensureOptionalStringArray(value: string[] | undefined, fieldName: string): void {
  if (value !== undefined) {
    ensureStringArray(value, fieldName);
  }
}

function ensureValidCreateInput(input: CreateMemoryInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!VALID_MEMORY_TYPES.includes(input.type)) {
    throw new AppError(
      "INVALID_REQUEST",
      `type must be one of: ${VALID_MEMORY_TYPES.join(", ")}.`,
      400
    );
  }

  if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
    throw new AppError("INVALID_REQUEST", "title is required and must be a non-empty string.", 400);
  }

  if (!input.content || typeof input.content !== "string" || !input.content.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      "content is required and must be a non-empty string.",
      400
    );
  }

  ensureOptionalStringArray(input.relatedMaterialIds, "relatedMaterialIds");
  ensureOptionalStringArray(input.relatedSkillIds, "relatedSkillIds");
  ensureOptionalStringArray(input.relatedQuizIds, "relatedQuizIds");
  ensureOptionalStringArray(input.relatedWrongbookIds, "relatedWrongbookIds");

  if (input.importance !== undefined && !VALID_IMPORTANCE.includes(input.importance)) {
    throw new AppError(
      "INVALID_REQUEST",
      `importance must be one of: ${VALID_IMPORTANCE.join(", ")}.`,
      400
    );
  }
}

function ensureValidUpdateInput(input: UpdateMemoryInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (input.type !== undefined && !VALID_MEMORY_TYPES.includes(input.type)) {
    throw new AppError(
      "INVALID_REQUEST",
      `type must be one of: ${VALID_MEMORY_TYPES.join(", ")}.`,
      400
    );
  }

  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim())) {
    throw new AppError("INVALID_REQUEST", "title must be a non-empty string.", 400);
  }

  if (input.content !== undefined && (typeof input.content !== "string" || !input.content.trim())) {
    throw new AppError("INVALID_REQUEST", "content must be a non-empty string.", 400);
  }

  ensureOptionalStringArray(input.relatedMaterialIds, "relatedMaterialIds");
  ensureOptionalStringArray(input.relatedSkillIds, "relatedSkillIds");
  ensureOptionalStringArray(input.relatedQuizIds, "relatedQuizIds");
  ensureOptionalStringArray(input.relatedWrongbookIds, "relatedWrongbookIds");

  if (input.importance !== undefined && !VALID_IMPORTANCE.includes(input.importance)) {
    throw new AppError(
      "INVALID_REQUEST",
      `importance must be one of: ${VALID_IMPORTANCE.join(", ")}.`,
      400
    );
  }
}

function ensureValidDailySummaryInput(input: DailySummaryInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!input.summary || typeof input.summary !== "string" || !input.summary.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      "summary is required and must be a non-empty string.",
      400
    );
  }

  if (input.planId !== undefined && typeof input.planId !== "string") {
    throw new AppError("INVALID_REQUEST", "planId must be a string.", 400);
  }

  ensureOptionalStringArray(input.learnedSkillIds, "learnedSkillIds");
  ensureOptionalStringArray(input.completedTaskIds, "completedTaskIds");
  ensureOptionalStringArray(input.wrongbookIds, "wrongbookIds");
  ensureOptionalStringArray(input.weaknesses, "weaknesses");
  ensureOptionalStringArray(input.nextSuggestions, "nextSuggestions");
}

function buildDailySummaryContent(input: DailySummaryInput): string {
  const parts = [`Summary: ${input.summary.trim()}`];

  if (input.weaknesses?.length) {
    parts.push(`Weaknesses: ${input.weaknesses.join(", ")}`);
  }

  if (input.nextSuggestions?.length) {
    parts.push(`Next suggestions: ${input.nextSuggestions.join(", ")}`);
  }

  return parts.join("\n");
}

export const memoryService = {
  list(): { items: MemoryItem[] } {
    return {
      items: memoryItems
    };
  },

  getById(id: string): MemoryItem {
    return memoryItems[findIndexById(id)];
  },

  create(input: CreateMemoryInput): MemoryItem {
    ensureValidCreateInput(input);

    const now = new Date().toISOString();
    const item: MemoryItem = {
      id: createMemoryId(),
      type: input.type,
      title: input.title.trim(),
      content: input.content.trim(),
      relatedMaterialIds: input.relatedMaterialIds ? [...input.relatedMaterialIds] : [],
      relatedSkillIds: input.relatedSkillIds ? [...input.relatedSkillIds] : [],
      relatedQuizIds: input.relatedQuizIds ? [...input.relatedQuizIds] : [],
      relatedWrongbookIds: input.relatedWrongbookIds ? [...input.relatedWrongbookIds] : [],
      importance: input.importance ?? "medium",
      createdAt: now,
      updatedAt: now
    };

    memoryItems.push(item);
    return item;
  },

  update(id: string, input: UpdateMemoryInput): MemoryItem {
    ensureValidUpdateInput(input);

    const index = findIndexById(id);
    const currentItem = memoryItems[index];
    const updatedItem: MemoryItem = {
      ...currentItem,
      type: input.type ?? currentItem.type,
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      content: input.content !== undefined ? input.content.trim() : currentItem.content,
      relatedMaterialIds:
        input.relatedMaterialIds !== undefined
          ? [...input.relatedMaterialIds]
          : currentItem.relatedMaterialIds,
      relatedSkillIds:
        input.relatedSkillIds !== undefined
          ? [...input.relatedSkillIds]
          : currentItem.relatedSkillIds,
      relatedQuizIds:
        input.relatedQuizIds !== undefined ? [...input.relatedQuizIds] : currentItem.relatedQuizIds,
      relatedWrongbookIds:
        input.relatedWrongbookIds !== undefined
          ? [...input.relatedWrongbookIds]
          : currentItem.relatedWrongbookIds,
      importance: input.importance ?? currentItem.importance,
      updatedAt: new Date().toISOString()
    };

    memoryItems[index] = updatedItem;
    return updatedItem;
  },

  remove(id: string): MemoryItem {
    const index = findIndexById(id);
    const [removedItem] = memoryItems.splice(index, 1);

    return removedItem;
  },

  createDailySummary(input: DailySummaryInput): MemoryItem {
    ensureValidDailySummaryInput(input);

    const now = new Date().toISOString();
    const item: MemoryItem = {
      id: createMemoryId(),
      type: "daily_summary",
      title: "Daily Summary",
      content: buildDailySummaryContent(input),
      relatedMaterialIds: [],
      relatedSkillIds: input.learnedSkillIds ? [...input.learnedSkillIds] : [],
      relatedQuizIds: [],
      relatedWrongbookIds: input.wrongbookIds ? [...input.wrongbookIds] : [],
      importance: "medium",
      createdAt: now,
      updatedAt: now
    };

    memoryItems.push(item);
    return item;
  }
};
