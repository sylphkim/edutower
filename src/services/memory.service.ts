<<<<<<< HEAD
import { memoryRepository, type MemoryRecord } from "../repositories/memory.repository";
=======
import { prisma } from "../lib/prisma";
import type { Memory as MemoryRow } from "../generated/prisma/client";
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
import type {
  CreateMemoryInput,
  DailySummaryInput,
  MemoryItem,
  UpdateMemoryInput
} from "../types/memory";
import { AppError } from "../utils/errors";

const VALID_MEMORY_TYPES = [
  "weakness",
  "daily_summary",
  "progress",
  "preference",
  "note"
];
const VALID_IMPORTANCE = ["low", "medium", "high"];

<<<<<<< HEAD
function ensureMemoryExists(record: MemoryRecord | null): MemoryRecord {
  if (!record) {
    throw new AppError("INVALID_REQUEST", "Memory item not found.", 404);
  }

  return record;
}
=======
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429

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
      "content must be a non-empty string.",
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
}

function toMemoryItem(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    type: row.type as MemoryItem["type"],
    title: row.title,
    content: row.content,
    relatedMaterialIds: JSON.parse(row.relatedMaterialIds),
    relatedSkillIds: JSON.parse(row.relatedSkillIds),
    relatedQuizIds: JSON.parse(row.relatedQuizIds),
    relatedWrongbookIds: JSON.parse(row.relatedWrongbookIds),
    importance: row.importance as MemoryItem["importance"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
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
<<<<<<< HEAD
    const records = await memoryRepository.list();

    return { items: records.map(toApiMemory) };
  },

  async getById(id: string): Promise<MemoryItem> {
    const record = ensureMemoryExists(await memoryRepository.findById(id));

    return toApiMemory(record);
=======
    const rows = await prisma.memory.findMany();
    return {items: rows.map(toMemoryItem)};
  },

  async getById(id: string): Promise<MemoryItem> {
    const row = await prisma.memory.findUnique({ where: { id } });

    if (!row) {
      throw new AppError("INVALID_REQUEST", "Memory item not found.", 404);
    }
    return toMemoryItem(row);
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
  },

  async create(input: CreateMemoryInput): Promise<MemoryItem> {
    ensureValidCreateInput(input);

<<<<<<< HEAD
    const record = await memoryRepository.create({
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
=======
    const row = await prisma.memory.create({
      data: {
        type: input.type,
        title: input.title.trim(),
        content: input.content.trim(),
        relatedMaterialIds: JSON.stringify(input.relatedMaterialIds ?? []),
        relatedSkillIds: JSON.stringify(input.relatedSkillIds ?? []),
        relatedQuizIds: JSON.stringify(input.relatedQuizIds ?? []),
        relatedWrongbookIds: JSON.stringify(input.relatedWrongbookIds ?? []),
        importance: input.importance ?? "medium"
      }
    });

    return toMemoryItem(row);
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
  },

  async update(id: string, input: UpdateMemoryInput): Promise<MemoryItem> {
    ensureValidUpdateInput(input);
    ensureMemoryExists(await memoryRepository.findById(id));

<<<<<<< HEAD
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

    const record = await memoryRepository.create({
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
=======
    const row = await prisma.memory.update({
      where: { id },
      data: {
        type: input.type,
        title: input.title?.trim(),
        content: input.content?.trim(),
        relatedMaterialIds: input.relatedMaterialIds !== undefined
          ? JSON.stringify(input.relatedMaterialIds)
          : undefined,
        relatedSkillIds: input.relatedSkillIds !== undefined
          ? JSON.stringify(input.relatedSkillIds)
          : undefined,
        relatedQuizIds: input.relatedQuizIds !== undefined
          ? JSON.stringify(input.relatedQuizIds)
          : undefined,
        relatedWrongbookIds: input.relatedWrongbookIds !== undefined
          ? JSON.stringify(input.relatedWrongbookIds)
          : undefined,
        importance: input.importance
      }
    });

    return toMemoryItem(row);
  },

  async remove(id: string): Promise<void> {
    const existing = await prisma.memory.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("INVALID_REQUEST", "Memory item not found.", 404);
    }

    await prisma.memory.delete({ where: { id } });
  },

  async findByTitle(title: string): Promise<MemoryItem | null> {
    const row = await prisma.memory.findFirst({
      where: { title: title.trim() }
    });
    return row ? toMemoryItem(row) : null;
  },

  async createDailySummary(input: DailySummaryInput): Promise<MemoryItem> {
    ensureValidDailySummaryInput(input);

    return memoryService.create({
      type: "daily_summary",
      title: `Daily Summary - ${new Date().toISOString().slice(0, 10)}`,
      content: input.summary
    });
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
  }
};