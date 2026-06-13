import { prisma } from "../lib/prisma";
import type {
  Concept,
  ConceptMastery,
  ConceptMasteryState
} from "../generated/prisma/client";

// Concept.aliases 与 ConceptMastery.sources 以 JSON 字符串存（SQLite 无数组类型），
// 仓库层负责序列化/反序列化，对上层只暴露字符串数组。

export interface ConceptRecord {
  id: string;
  userId: string;
  key: string;
  name: string;
  subject: string | null;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConceptMasteryRecord {
  id: string;
  userId: string;
  conceptId: string;
  state: ConceptMasteryState;
  mastery: number;
  sources: string[];
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConceptWithMastery extends ConceptRecord {
  masteryRecord: ConceptMasteryRecord | null;
}

export interface UpsertConceptInput {
  key: string;
  name: string;
  subject?: string | null;
  aliases?: string[];
}

export interface UpsertMasteryInput {
  state?: ConceptMasteryState;
  mastery?: number;
  sources?: string[];
  lastSeenAt?: Date | null;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toConceptRecord(concept: Concept): ConceptRecord {
  return {
    id: concept.id,
    userId: concept.userId,
    key: concept.key,
    name: concept.name,
    subject: concept.subject,
    aliases: parseJsonArray(concept.aliases),
    createdAt: concept.createdAt,
    updatedAt: concept.updatedAt
  };
}

function toMasteryRecord(mastery: ConceptMastery): ConceptMasteryRecord {
  return {
    id: mastery.id,
    userId: mastery.userId,
    conceptId: mastery.conceptId,
    state: mastery.state,
    mastery: mastery.mastery,
    sources: parseJsonArray(mastery.sources),
    lastSeenAt: mastery.lastSeenAt,
    createdAt: mastery.createdAt,
    updatedAt: mastery.updatedAt
  };
}

export const conceptsRepository = {
  // ── Concept（用户级概念词表） ─────────────────────────────
  /**
   * 按归一化 key upsert。跨项目 / 自由答疑里同一个知识点都归一到同一个 key，
   * 落到 @@unique([userId, key]) 这一行——这就是去重的落点。
   */
  async upsertConcept(userId: string, input: UpsertConceptInput): Promise<ConceptRecord> {
    const concept = await prisma.concept.upsert({
      where: { userId_key: { userId, key: input.key } },
      update: {
        name: input.name,
        subject: input.subject ?? undefined,
        ...(input.aliases ? { aliases: JSON.stringify(input.aliases) } : {})
      },
      create: {
        userId,
        key: input.key,
        name: input.name,
        subject: input.subject ?? null,
        aliases: JSON.stringify(input.aliases ?? [])
      }
    });

    return toConceptRecord(concept);
  },

  async findConceptByKey(userId: string, key: string): Promise<ConceptRecord | null> {
    const concept = await prisma.concept.findUnique({
      where: { userId_key: { userId, key } }
    });

    return concept ? toConceptRecord(concept) : null;
  },

  async listConcepts(userId: string): Promise<ConceptRecord[]> {
    const concepts = await prisma.concept.findMany({
      where: { userId },
      orderBy: [{ subject: "asc" }, { name: "asc" }]
    });

    return concepts.map(toConceptRecord);
  },

  // ── 节点 ↔ 概念 映射 ──────────────────────────────────────
  /** 幂等地把一个知识点连到一个概念上（多对多）。 */
  async linkNodeConcept(
    knowledgeNodeId: string,
    conceptId: string,
    source?: string
  ): Promise<void> {
    await prisma.knowledgeNodeConcept.upsert({
      where: { knowledgeNodeId_conceptId: { knowledgeNodeId, conceptId } },
      update: source !== undefined ? { source } : {},
      create: { knowledgeNodeId, conceptId, source: source ?? null }
    });
  },

  /** 取某概念关联的所有知识点 id（后续预点亮 / 反查用）。 */
  async listNodeIdsForConcept(conceptId: string): Promise<string[]> {
    const links = await prisma.knowledgeNodeConcept.findMany({
      where: { conceptId },
      select: { knowledgeNodeId: true }
    });

    return links.map((link) => link.knowledgeNodeId);
  },

  // ── ConceptMastery（掌握账本，跨项目汇总） ─────────────────
  /** 写入/更新某概念的掌握进度（conceptId 唯一 → 与 Concept 一对一）。 */
  async upsertMastery(
    userId: string,
    conceptId: string,
    input: UpsertMasteryInput
  ): Promise<ConceptMasteryRecord> {
    const mastery = await prisma.conceptMastery.upsert({
      where: { conceptId },
      update: {
        state: input.state,
        mastery: input.mastery,
        ...(input.sources ? { sources: JSON.stringify(input.sources) } : {}),
        lastSeenAt: input.lastSeenAt ?? undefined
      },
      create: {
        userId,
        conceptId,
        state: input.state ?? "learning",
        mastery: input.mastery ?? 0,
        sources: JSON.stringify(input.sources ?? []),
        lastSeenAt: input.lastSeenAt ?? null
      }
    });

    return toMasteryRecord(mastery);
  },

  async getMasteryByConcept(conceptId: string): Promise<ConceptMasteryRecord | null> {
    const mastery = await prisma.conceptMastery.findUnique({ where: { conceptId } });

    return mastery ? toMasteryRecord(mastery) : null;
  },

  /** 全局技能图谱用：该用户所有概念 + 各自的掌握账本（不进项目也能展示）。 */
  async listConceptsWithMastery(userId: string): Promise<ConceptWithMastery[]> {
    const concepts = await prisma.concept.findMany({
      where: { userId },
      include: { mastery: true },
      orderBy: [{ subject: "asc" }, { name: "asc" }]
    });

    return concepts.map((concept) => ({
      ...toConceptRecord(concept),
      masteryRecord: concept.mastery ? toMasteryRecord(concept.mastery) : null
    }));
  }
};
