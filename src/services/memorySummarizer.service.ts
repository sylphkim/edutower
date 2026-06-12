import { memoryService } from "./memory.service";
import type { MemoryItem, MemoryType } from "../types/memory";

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

    const charsA = [...new Set(a.match(/[\u4e00-\u9fff]/g) || [])];
    const charsB = [...new Set(b.match(/[\u4e00-\u9fff]/g) || [])];
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
