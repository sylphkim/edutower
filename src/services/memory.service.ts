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
import { getDemoUserId } from "./demo.service";

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
    const userId = await getDemoUserId();
    const record = ensureMemoryExists(await memoryRepository.findById(id, userId));

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

    const userId = await getDemoUserId();
    ensureMemoryExists(await memoryRepository.findById(id, userId));

    const record = await memoryRepository.update(id, userId, {
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
    const userId = await getDemoUserId();
    ensureMemoryExists(await memoryRepository.findById(id, userId));

    const record = await memoryRepository.deleteById(id, userId);

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

// —— 记忆去重/摘要（原 memorySummarizer.service，同属记忆域，合并进来）——

/**
 * 把同类型的多条记忆按相似度合并为一条摘要。
 */
export const memorySummarizerService = {
  async summarizeByType(type: MemoryType, minCount = 3): Promise<{ merged: number }> {
    const { items } = await memoryService.list();
    const candidates = items.filter((m) => m.type === type);

    if (candidates.length < minCount) return { merged: 0 };

    const groups = this.groupBySimilarTitle(candidates);
    let mergedCount = 0;

    for (const group of groups) {
      if (group.length < minCount) continue;

      const sorted = [...group].sort(
        (a, b) => importanceRank(b.importance) - importanceRank(a.importance)
      );
      const primary = sorted[0];

      const mergedContent = sorted
        .map((m) => m.content.trim())
        .filter((c, i, arr) => arr.indexOf(c) === i)
        .join("\n---\n");

      const mergedTitle =
        group.length > 1
          ? `${primary.title}（共 ${group.length} 条合并）`
          : primary.title;

      const allMaterialIds = [...new Set(group.flatMap((m) => m.relatedMaterialIds))];
      const allSkillIds = [...new Set(group.flatMap((m) => m.relatedSkillIds))];
      const allQuizIds = [...new Set(group.flatMap((m) => m.relatedQuizIds))];
      const allWrongbookIds = [...new Set(group.flatMap((m) => m.relatedWrongbookIds))];

      await memoryService.create({
        type,
        title: mergedTitle,
        content: mergedContent,
        importance: primary.importance,
        relatedMaterialIds: allMaterialIds,
        relatedSkillIds: allSkillIds,
        relatedQuizIds: allQuizIds,
        relatedWrongbookIds: allWrongbookIds
      });

      for (const item of group) {
        await memoryService.remove(item.id).catch(() => {});
      }

      mergedCount += group.length;
    }

    return { merged: mergedCount };
  },

  async summarizeAll(minCount = 3): Promise<{ merged: number; types: string[] }> {
    const types: MemoryType[] = ["weakness", "note", "progress", "preference"];
    let total = 0;
    for (const t of types) {
      total += (await this.summarizeByType(t, minCount)).merged;
    }
    return { merged: total, types };
  },

  /**
   * 按标题相似度分组。
   * 匹配策略：bigram 重叠 > 0 或汉字共现比例 > 30%
   */
  groupBySimilarTitle(items: MemoryItem[]): MemoryItem[][] {
    const groups: MemoryItem[][] = [];
    const assigned = new Set<string>();

    for (const item of items) {
      if (assigned.has(item.id)) continue;

      const group: MemoryItem[] = [item];
      assigned.add(item.id);

      for (const other of items) {
        if (assigned.has(other.id)) continue;
        if (this.areTitlesSimilar(item.title, other.title)) {
          group.push(other);
          assigned.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  },

  /** 判断两个标题是否相似 */
  areTitlesSimilar(a: string, b: string): boolean {
    const bigramsA = this.extractBigrams(a);
    const bigramsB = this.extractBigrams(b);
    if (bigramsA.some((k) => bigramsB.includes(k))) return true;

    const charsA = [...new Set(a.match(/[一-鿿]/g) || [])];
    const charsB = [...new Set(b.match(/[一-鿿]/g) || [])];
    if (charsA.length === 0 || charsB.length === 0) return false;

    const overlap = charsA.filter((c) => charsB.includes(c)).length;
    return Math.max(overlap / charsA.length, overlap / charsB.length) > 0.3;
  },

  /** 从字符串提取二元词组 */
  extractBigrams(text: string): string[] {
    const result: string[] = [];
    for (let i = 0; i < text.length - 1; i++) result.push(text.slice(i, i + 2));
    return [...new Set(result)];
  },

  /** 从标题中提取关键词 */
  extractKeywords(title: string): string[] {
    const tokens = title.split(/[\s,，。；;：:、！!？?()（）]+/);
    const words = tokens.map((t) => t.trim()).filter((t) => t.length >= 2 && !/^\d+$/.test(t));
    const bigrams: string[] = [];
    for (const token of words) {
      if (token.length >= 4) {
        for (let i = 0; i < token.length - 1; i++) bigrams.push(token.slice(i, i + 2));
      }
    }
    return [...new Set([...words, ...bigrams])];
  }
};

function importanceRank(importance: string): number {
  return importance === "high" ? 3 : importance === "medium" ? 2 : 1;
}
