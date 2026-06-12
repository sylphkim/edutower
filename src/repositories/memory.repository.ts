import { prisma } from "../lib/prisma";
import type { Memory } from "../generated/prisma/client";

// Memory 表把四个 related*Ids 以 JSON 字符串存（SQLite 无数组类型），
// 仓库层负责序列化/反序列化，对上层只暴露字符串数组。
export interface MemoryRecord {
  id: string;
  type: string;
  title: string;
  content: string;
  importance: string;
  relatedMaterialIds: string[];
  relatedSkillIds: string[];
  relatedQuizIds: string[];
  relatedWrongbookIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMemoryRecordInput {
  type: string;
  title: string;
  content: string;
  importance: string;
  relatedMaterialIds: string[];
  relatedSkillIds: string[];
  relatedQuizIds: string[];
  relatedWrongbookIds: string[];
}

export interface UpdateMemoryRecordData {
  type?: string;
  title?: string;
  content?: string;
  importance?: string;
  relatedMaterialIds?: string[];
  relatedSkillIds?: string[];
  relatedQuizIds?: string[];
  relatedWrongbookIds?: string[];
}

function parseIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function serializeIds(value: string[] | undefined): string | undefined {
  return value !== undefined ? JSON.stringify(value) : undefined;
}

function toRecord(memory: Memory): MemoryRecord {
  return {
    id: memory.id,
    type: memory.type,
    title: memory.title,
    content: memory.content,
    importance: memory.importance,
    relatedMaterialIds: parseIds(memory.relatedMaterialIds),
    relatedSkillIds: parseIds(memory.relatedSkillIds),
    relatedQuizIds: parseIds(memory.relatedQuizIds),
    relatedWrongbookIds: parseIds(memory.relatedWrongbookIds),
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt
  };
}

export const memoryRepository = {
  async list(): Promise<MemoryRecord[]> {
    const items = await prisma.memory.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    return items.map(toRecord);
  },

  async findById(id: string): Promise<MemoryRecord | null> {
    const item = await prisma.memory.findUnique({ where: { id } });

    return item ? toRecord(item) : null;
  },

  async findByTitle(title: string): Promise<MemoryRecord | null> {
    const item = await prisma.memory.findFirst({ where: { title: title.trim() } });

    return item ? toRecord(item) : null;
  },

  async create(input: CreateMemoryRecordInput): Promise<MemoryRecord> {
    const item = await prisma.memory.create({
      data: {
        type: input.type,
        title: input.title,
        content: input.content,
        importance: input.importance,
        relatedMaterialIds: JSON.stringify(input.relatedMaterialIds),
        relatedSkillIds: JSON.stringify(input.relatedSkillIds),
        relatedQuizIds: JSON.stringify(input.relatedQuizIds),
        relatedWrongbookIds: JSON.stringify(input.relatedWrongbookIds)
      }
    });

    return toRecord(item);
  },

  async update(id: string, data: UpdateMemoryRecordData): Promise<MemoryRecord> {
    const item = await prisma.memory.update({
      where: { id },
      data: {
        type: data.type,
        title: data.title,
        content: data.content,
        importance: data.importance,
        relatedMaterialIds: serializeIds(data.relatedMaterialIds),
        relatedSkillIds: serializeIds(data.relatedSkillIds),
        relatedQuizIds: serializeIds(data.relatedQuizIds),
        relatedWrongbookIds: serializeIds(data.relatedWrongbookIds)
      }
    });

    return toRecord(item);
  },

  async deleteById(id: string): Promise<MemoryRecord> {
    const item = await prisma.memory.delete({ where: { id } });

    return toRecord(item);
  }
};
