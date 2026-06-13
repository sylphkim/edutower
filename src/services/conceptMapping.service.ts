import { conceptsRepository } from "../repositories/concepts.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import { projectsRepository } from "../repositories/projects.repository";
import { AppError } from "../utils/errors";

/**
 * 节点 → 概念 映射器（v1：归一化字符串）。
 *
 * 把项目里的 KnowledgeNode 映射到跨项目的 Concept：以归一化后的标题为 key，
 * 同名知识点（不同项目 / 自由答疑）落到同一个 Concept，从而能跨项目认出、点亮。
 *
 * v1 局限：只按「标题归一化」匹配，能认出**同名**知识点；像「物理·梯度」用到
 * 「高数·偏导」这种**异名但相通**的关系，留给 v2（FastAPI 的 AI 打标 / embedding）。
 */

/** 归一化标题为去重 key：全角→半角、转小写、去空白/标点/符号。 */
export function normalizeConceptKey(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export interface MappableNode {
  id: string;
  title: string;
}

export const conceptMappingService = {
  normalizeConceptKey,

  /** 把单个节点映射到一个概念并建立连接；标题归一化为空时跳过，返回 null。 */
  async mapNode(
    userId: string,
    node: MappableNode,
    subject?: string | null
  ): Promise<string | null> {
    const name = node.title.trim();
    const key = normalizeConceptKey(name);

    if (!key) {
      return null;
    }

    const concept = await conceptsRepository.upsertConcept(userId, {
      key,
      name,
      subject: subject ?? null
    });
    await conceptsRepository.linkNodeConcept(node.id, concept.id, "normalized");

    return concept.id;
  },

  /** 映射某项目下全部未归档节点。 */
  async mapProjectNodes(
    userId: string,
    projectId: string
  ): Promise<{ mapped: number; skipped: number }> {
    const project = await projectsRepository.findByIdForUser(projectId, userId);

    if (!project) {
      throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
    }

    const nodes = await knowledgeNodesRepository.listTreeByProject(projectId, false);
    let mapped = 0;
    let skipped = 0;

    for (const node of nodes) {
      const conceptId = await this.mapNode(
        userId,
        { id: node.id, title: node.title },
        project.subject
      );

      if (conceptId) {
        mapped += 1;
      } else {
        skipped += 1;
      }
    }

    return { mapped, skipped };
  },

  /**
   * 把一批「已确认掌握 / 学习中」的节点写进概念账本（跨项目汇总）。
   * 掌握度取各项目最大值；状态只要某处达到 mastered 即 mastered；来源累加。
   * 节点为 not_started 时跳过（账本只记真正学过的）。
   */
  async recordNodeMastery(
    userId: string,
    projectId: string,
    nodeIds: string[]
  ): Promise<{ recorded: number }> {
    if (nodeIds.length === 0) {
      return { recorded: 0 };
    }

    const project = await projectsRepository.findByIdForUser(projectId, userId);
    const subject = project?.subject ?? null;
    let recorded = 0;

    for (const nodeId of nodeIds) {
      const node = await knowledgeNodesRepository.findByIdForProject(nodeId, projectId);

      if (!node || node.learningState === "not_started") {
        continue;
      }

      const conceptId = await this.mapNode(userId, { id: node.id, title: node.title }, subject);

      if (!conceptId) {
        continue;
      }

      const existing = await conceptsRepository.getMasteryByConcept(conceptId);
      const source = `project:${projectId}`;
      const sources = existing ? [...new Set([...existing.sources, source])] : [source];
      const mastery = Math.max(existing?.mastery ?? 0, node.mastery);
      const state =
        existing?.state === "mastered" || node.learningState === "mastered"
          ? "mastered"
          : "learning";

      await conceptsRepository.upsertMastery(userId, conceptId, {
        state,
        mastery,
        sources,
        lastSeenAt: new Date()
      });
      recorded += 1;
    }

    return { recorded };
  }
};
