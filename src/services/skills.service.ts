import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import type { KnowledgeNodeStatus } from "../generated/prisma/client";
import type { KnowledgeNodeWithPrerequisites } from "../repositories/knowledgeNodes.repository";
import type {
  CreateSkillInput,
  SkillItem,
  SkillStatus,
  SkillTreeItem,
  UpdateSkillInput
} from "../types/skills";
import { AppError } from "../utils/errors";
import { getDemoProjectId } from "./demoProject.service";

const VALID_STATUSES: SkillStatus[] = ["locked", "available", "in_progress", "mastered"];

function ensureSkillExists(
  item: KnowledgeNodeWithPrerequisites | null
): KnowledgeNodeWithPrerequisites {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Skill item not found.", 404);
  }

  return item;
}

function ensureValidMastery(mastery: number): void {
  if (typeof mastery !== "number" || !Number.isFinite(mastery) || mastery < 0 || mastery > 100) {
    throw new AppError("INVALID_REQUEST", "mastery must be a number between 0 and 100.", 400);
  }
}

function ensureValidPrerequisites(prerequisites: string[]): void {
  if (!Array.isArray(prerequisites)) {
    throw new AppError("INVALID_REQUEST", "prerequisites must be an array.", 400);
  }

  if (prerequisites.some((id) => typeof id !== "string" || !id.trim())) {
    throw new AppError("INVALID_REQUEST", "prerequisites must contain non-empty strings.", 400);
  }
}

function ensureValidCreateInput(input: CreateSkillInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
    throw new AppError("INVALID_REQUEST", "title is required and must be a non-empty string.", 400);
  }

  if (input.description !== undefined && typeof input.description !== "string") {
    throw new AppError("INVALID_REQUEST", "description must be a string.", 400);
  }

  if (input.parentId !== undefined && (typeof input.parentId !== "string" || !input.parentId)) {
    throw new AppError("INVALID_REQUEST", "parentId must be a non-empty string.", 400);
  }

  if (input.prerequisites !== undefined) {
    ensureValidPrerequisites(input.prerequisites);
  }

  if (input.status !== undefined && !VALID_STATUSES.includes(input.status)) {
    throw new AppError(
      "INVALID_REQUEST",
      `status must be one of: ${VALID_STATUSES.join(", ")}.`,
      400
    );
  }

  if (input.mastery !== undefined) {
    ensureValidMastery(input.mastery);
  }

  if (
    input.order !== undefined &&
    (typeof input.order !== "number" || !Number.isFinite(input.order))
  ) {
    throw new AppError("INVALID_REQUEST", "order must be a number.", 400);
  }
}

function ensureValidUpdateInput(id: string, input: UpdateSkillInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim())) {
    throw new AppError("INVALID_REQUEST", "title must be a non-empty string.", 400);
  }

  if (input.description !== undefined && typeof input.description !== "string") {
    throw new AppError("INVALID_REQUEST", "description must be a string.", 400);
  }

  if (
    input.parentId !== undefined &&
    input.parentId !== null &&
    (typeof input.parentId !== "string" || !input.parentId)
  ) {
    throw new AppError("INVALID_REQUEST", "parentId must be a non-empty string or null.", 400);
  }

  if (input.parentId === id) {
    throw new AppError("INVALID_REQUEST", "parentId cannot be the same as id.", 400);
  }

  if (input.prerequisites !== undefined) {
    ensureValidPrerequisites(input.prerequisites);

    if (input.prerequisites.includes(id)) {
      throw new AppError("INVALID_REQUEST", "prerequisites cannot include itself.", 400);
    }
  }

  if (input.status !== undefined && !VALID_STATUSES.includes(input.status)) {
    throw new AppError(
      "INVALID_REQUEST",
      `status must be one of: ${VALID_STATUSES.join(", ")}.`,
      400
    );
  }

  if (input.mastery !== undefined) {
    ensureValidMastery(input.mastery);
  }

  if (
    input.order !== undefined &&
    (typeof input.order !== "number" || !Number.isFinite(input.order))
  ) {
    throw new AppError("INVALID_REQUEST", "order must be a number.", 400);
  }
}

async function ensureParentBelongsToProject(
  parentId: string | undefined,
  projectId: string
): Promise<void> {
  if (!parentId) {
    return;
  }

  const parent = await knowledgeNodesRepository.findByIdForProject(parentId, projectId);

  if (!parent) {
    throw new AppError(
      "INVALID_REQUEST",
      "parentId must reference an existing skill in the same project.",
      400
    );
  }
}

async function ensurePrerequisitesBelongToProject(
  id: string | undefined,
  prerequisiteIds: string[],
  projectId: string
): Promise<void> {
  const uniquePrerequisiteIds = new Set(prerequisiteIds);

  if (uniquePrerequisiteIds.size !== prerequisiteIds.length) {
    throw new AppError("INVALID_REQUEST", "prerequisites cannot contain duplicates.", 400);
  }

  if (id && uniquePrerequisiteIds.has(id)) {
    throw new AppError("INVALID_REQUEST", "prerequisites cannot include itself.", 400);
  }

  const count = await knowledgeNodesRepository.countByIdsForProject(
    prerequisiteIds,
    projectId
  );

  if (count !== prerequisiteIds.length) {
    throw new AppError(
      "INVALID_REQUEST",
      "prerequisites must reference skills in the same project.",
      400
    );
  }
}

function toKnowledgeNodeStatus(status: SkillStatus): KnowledgeNodeStatus {
  return status as KnowledgeNodeStatus;
}

function toApiSkill(item: KnowledgeNodeWithPrerequisites): SkillItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? undefined,
    parentId: item.parentId ?? undefined,
    prerequisites: item.prerequisiteLinks.map((link) => link.prerequisiteId),
    status: item.status as SkillStatus,
    mastery: item.mastery,
    order: item.order,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function buildTree(items: SkillItem[]): SkillTreeItem[] {
  const itemMap = new Map<string, SkillTreeItem>();
  const roots: SkillTreeItem[] = [];

  for (const item of items) {
    itemMap.set(item.id, {
      ...item,
      prerequisites: [...item.prerequisites],
      children: []
    });
  }

  for (const item of itemMap.values()) {
    if (item.parentId && itemMap.has(item.parentId)) {
      itemMap.get(item.parentId)!.children.push(item);
    } else {
      roots.push(item);
    }
  }

  const sortByOrder = (treeItems: SkillTreeItem[]): void => {
    treeItems.sort((left, right) => left.order - right.order);
    treeItems.forEach((item) => sortByOrder(item.children));
  };

  sortByOrder(roots);
  return roots;
}

export const skillsService = {
  async list(): Promise<{ items: SkillItem[] }> {
    const projectId = await getDemoProjectId();
    const items = await knowledgeNodesRepository.listByProject(projectId);

    return {
      items: items.map(toApiSkill)
    };
  },

  async getById(id: string): Promise<SkillItem> {
    const projectId = await getDemoProjectId();
    const item = ensureSkillExists(await knowledgeNodesRepository.findByIdForProject(id, projectId));

    return toApiSkill(item);
  },

  async getTree(): Promise<{ items: SkillTreeItem[] }> {
    const projectId = await getDemoProjectId();
    const items = await knowledgeNodesRepository.listByProject(projectId);

    return {
      items: buildTree(items.map(toApiSkill))
    };
  },

  async create(input: CreateSkillInput): Promise<SkillItem> {
    ensureValidCreateInput(input);

    const projectId = await getDemoProjectId();
    await ensureParentBelongsToProject(input.parentId, projectId);
    await ensurePrerequisitesBelongToProject(
      undefined,
      input.prerequisites ?? [],
      projectId
    );

    const item = await knowledgeNodesRepository.create({
      projectId,
      title: input.title.trim(),
      description: input.description,
      parentId: input.parentId,
      status: toKnowledgeNodeStatus(input.status ?? "available"),
      mastery: input.mastery ?? 0,
      order:
        input.order ??
        (await knowledgeNodesRepository.countByProject(projectId)) + 1,
      prerequisiteIds: input.prerequisites ?? []
    });

    return toApiSkill(item);
  },

  async update(id: string, input: UpdateSkillInput): Promise<SkillItem> {
    ensureValidUpdateInput(id, input);

    const projectId = await getDemoProjectId();
    const currentItem = ensureSkillExists(
      await knowledgeNodesRepository.findByIdForProject(id, projectId)
    );
    await ensureParentBelongsToProject(input.parentId ?? undefined, projectId);
    if (input.prerequisites !== undefined) {
      await ensurePrerequisitesBelongToProject(id, input.prerequisites, projectId);
    }

    const updatedItem = await knowledgeNodesRepository.updateByIdForProject(id, projectId, {
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      description: input.description ?? currentItem.description ?? undefined,
      parentId:
        input.parentId !== undefined ? input.parentId ?? null : currentItem.parentId,
      status:
        input.status !== undefined
          ? toKnowledgeNodeStatus(input.status)
          : currentItem.status,
      mastery: input.mastery ?? currentItem.mastery,
      order: input.order ?? currentItem.order,
      prerequisiteIds: input.prerequisites
    });

    return toApiSkill(updatedItem);
  },

  async remove(id: string): Promise<SkillItem> {
    const projectId = await getDemoProjectId();
    const currentItem = ensureSkillExists(
      await knowledgeNodesRepository.findByIdForProject(id, projectId)
    );
    await knowledgeNodesRepository.deleteByIdForProject(id, projectId);

    return toApiSkill(currentItem);
  }
};
