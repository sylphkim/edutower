import { memoryRepository, type MemoryRecord } from "../repositories/memory.repository";
import type {
  CreateMemoryInput,
  DailySummaryInput,
  MemoryImportance,
  MemoryItem,
  MemoryType,
  UpdateMemoryInput
} from "../types/memory";
import { AppError } from "../utils/errors";
import { getDemoUserId } from "./demoUser.service";

const VALID_MEMORY_TYPES: MemoryType[] = [
  "weakness",
  "daily_summary",
  "progress",
  "preference",
  "note"
];
const VALID_IMPORTANCE: MemoryImportance[] = ["low", "medium", "high"];

function ensureMemoryExists(record: MemoryRecord | null): MemoryRecord {
  if (!record) {
    throw new AppError("INVALID_REQUEST", "Memory item not found.", 404);
  }

  return record;
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

function toApiMemory(record: MemoryRecord): MemoryItem {
  return {
    id: record.id,
    type: record.type as MemoryType,
    title: record.title,
    content: record.content,
    relatedMaterialIds: record.relatedMaterialIds,
    relatedSkillIds: record.relatedSkillIds,
    relatedQuizIds: record.relatedQuizIds,
    relatedWrongbookIds: record.relatedWrongbookIds,
    importance: record.importance as MemoryImportance,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export const memoryService = {
  async list(): Promise<{ items: MemoryItem[] }> {
    const userId = await getDemoUserId();
    const records = await memoryRepository.list(userId);

    return { items: records.map(toApiMemory) };
  },

  async getById(id: string): Promise<MemoryItem> {
    const record = ensureMemoryExists(await memoryRepository.findById(id));

    return toApiMemory(record);
  },

  async findByTitle(title: string): Promise<MemoryItem | null> {
    const userId = await getDemoUserId();
    const record = await memoryRepository.findByTitle(userId, title);

    return record ? toApiMemory(record) : null;
  },

  async create(input: CreateMemoryInput): Promise<MemoryItem> {
    ensureValidCreateInput(input);

    const userId = await getDemoUserId();
    const record = await memoryRepository.create({
      userId,
      type: input.type,
      title: input.title.trim(),
      content: input.content.trim(),
      importance: input.importance ?? "medium",
      relatedMaterialIds: input.relatedMaterialIds ?? [],
      relatedSkillIds: input.relatedSkillIds ?? [],
      relatedQuizIds: input.relatedQuizIds ?? [],
      relatedWrongbookIds: input.relatedWrongbookIds ?? []
    });

    return toApiMemory(record);
  },

  async update(id: string, input: UpdateMemoryInput): Promise<MemoryItem> {
    ensureValidUpdateInput(input);
    ensureMemoryExists(await memoryRepository.findById(id));

    const record = await memoryRepository.update(id, {
      type: input.type,
      title: input.title !== undefined ? input.title.trim() : undefined,
      content: input.content !== undefined ? input.content.trim() : undefined,
      importance: input.importance,
      relatedMaterialIds: input.relatedMaterialIds,
      relatedSkillIds: input.relatedSkillIds,
      relatedQuizIds: input.relatedQuizIds,
      relatedWrongbookIds: input.relatedWrongbookIds
    });

    return toApiMemory(record);
  },

  async remove(id: string): Promise<MemoryItem> {
    ensureMemoryExists(await memoryRepository.findById(id));

    const record = await memoryRepository.deleteById(id);

    return toApiMemory(record);
  },

  async createDailySummary(input: DailySummaryInput): Promise<MemoryItem> {
    ensureValidDailySummaryInput(input);

    const userId = await getDemoUserId();
    const record = await memoryRepository.create({
      userId,
      type: "daily_summary",
      title: "Daily Summary",
      content: buildDailySummaryContent(input),
      importance: "medium",
      relatedMaterialIds: [],
      relatedSkillIds: input.learnedSkillIds ? [...input.learnedSkillIds] : [],
      relatedQuizIds: [],
      relatedWrongbookIds: input.wrongbookIds ? [...input.wrongbookIds] : []
    });

    return toApiMemory(record);
  }
};
