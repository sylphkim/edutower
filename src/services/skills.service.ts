import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import type { KnowledgeNodeLearningState } from "../generated/prisma/client";
import type { KnowledgeNodeWithPrerequisites } from "../repositories/knowledgeNodes.repository";
import type {
  CreateSkillInput,
  SkillDependencyEdge,
  SkillItem,
  SkillLearningState,
  SkillTreeResponse,
  SkillTreeItem,
  UpdateSkillLearningStateInput
} from "../types/skills";
import { AppError } from "../utils/errors";
import { getDemoProjectId } from "./demoProject.service";

const VALID_LEARNING_STATES: SkillLearningState[] = ["not_started", "learning", "mastered"];

interface GetSkillTreeOptions {
  projectId?: string;
  includeArchived?: boolean;
}

interface UpdateSkillOptions {
  projectId?: string;
}

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

  if (input.learningState !== undefined && !VALID_LEARNING_STATES.includes(input.learningState)) {
    throw new AppError(
      "INVALID_REQUEST",
      `learningState must be one of: ${VALID_LEARNING_STATES.join(", ")}.`,
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

function ensureValidLearningStateUpdateInput(
  input: unknown
): UpdateSkillLearningStateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== "learningState") {
    throw new AppError(
      "INVALID_REQUEST",
      "PATCH /api/skills/:id only accepts learningState.",
      400
    );
  }

  const learningState = body.learningState;

  if (
    typeof learningState !== "string" ||
    !VALID_LEARNING_STATES.includes(learningState as SkillLearningState)
  ) {
    throw new AppError(
      "INVALID_REQUEST",
      `learningState must be one of: ${VALID_LEARNING_STATES.join(", ")}.`,
      400
    );
  }

  return {
    learningState: learningState as SkillLearningState
  };
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

function toKnowledgeNodeLearningState(
  learningState: SkillLearningState
): KnowledgeNodeLearningState {
  return learningState as KnowledgeNodeLearningState;
}

function toApiSkill(item: KnowledgeNodeWithPrerequisites): SkillItem {
  const prerequisiteIds = item.prerequisiteLinks
    .map((link) => link.prerequisiteId)
    .sort((left, right) => left.localeCompare(right));

  return {
    id: item.id,
    title: item.title,
    description: item.description ?? undefined,
    parentId: item.parentId ?? undefined,
    prerequisites: prerequisiteIds,
    learningState: item.learningState as SkillLearningState,
    isUnlocked: item.isUnlocked,
    unlockedAt: item.unlockedAt?.toISOString(),
    mastery: item.mastery,
    order: item.order,
    archivedAt: item.archivedAt?.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function compareTreeItems(left: SkillTreeItem, right: SkillTreeItem): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function buildTree(items: SkillTreeItem[]): SkillTreeItem[] {
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
    treeItems.sort(compareTreeItems);
    treeItems.forEach((item) => sortByOrder(item.children));
  };

  sortByOrder(roots);
  return roots;
}

function toTreeSkill(
  item: KnowledgeNodeWithPrerequisites,
  visibleItemMap: Map<string, KnowledgeNodeWithPrerequisites>
): SkillTreeItem {
  const visiblePrerequisiteIds = item.prerequisiteLinks
    .map((link) => link.prerequisiteId)
    .filter((prerequisiteId) => visibleItemMap.has(prerequisiteId))
    .sort((left, right) => left.localeCompare(right));
  const riskPrerequisiteIds = item.isUnlocked
    ? visiblePrerequisiteIds.filter(
        (prerequisiteId) => visibleItemMap.get(prerequisiteId)?.learningState !== "mastered"
      )
    : [];

  return {
    ...toApiSkill(item),
    prerequisites: visiblePrerequisiteIds,
    prerequisiteRisk: riskPrerequisiteIds.length > 0,
    riskPrerequisiteIds,
    children: []
  };
}

function buildDependencyEdges(
  items: KnowledgeNodeWithPrerequisites[],
  visibleItemMap: Map<string, KnowledgeNodeWithPrerequisites>
): SkillDependencyEdge[] {
  return items
    .flatMap((item) =>
      item.prerequisiteLinks
        .filter((link) => visibleItemMap.has(link.prerequisiteId))
        .map((link) => ({
          sourceId: link.prerequisiteId,
          targetId: item.id
        }))
    )
    .sort((left, right) => {
      const sourceCompare = left.sourceId.localeCompare(right.sourceId);
      return sourceCompare !== 0 ? sourceCompare : left.targetId.localeCompare(right.targetId);
    });
}

async function resolveProjectId(projectId: string | undefined): Promise<string> {
  const normalizedProjectId = projectId?.trim();

  if (normalizedProjectId) {
    return normalizedProjectId;
  }

  return getDemoProjectId();
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

  async getTree(options: GetSkillTreeOptions = {}): Promise<SkillTreeResponse> {
    const projectId = await resolveProjectId(options.projectId);
    const items = await knowledgeNodesRepository.listTreeByProject(
      projectId,
      Boolean(options.includeArchived)
    );
    const visibleItemMap = new Map(items.map((item) => [item.id, item]));
    const treeItems = items.map((item) => toTreeSkill(item, visibleItemMap));

    return {
      items: buildTree(treeItems),
      dependencyEdges: buildDependencyEdges(items, visibleItemMap)
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
      learningState: toKnowledgeNodeLearningState(input.learningState ?? "not_started"),
      mastery: input.mastery ?? 0,
      order:
        input.order ??
        (await knowledgeNodesRepository.countByProject(projectId)) + 1,
      prerequisiteIds: input.prerequisites ?? []
    });

    return toApiSkill(item);
  },

  async update(
    id: string,
    input: unknown,
    options: UpdateSkillOptions = {}
  ): Promise<SkillItem> {
    const updateInput = ensureValidLearningStateUpdateInput(input);
    const projectId = await resolveProjectId(options.projectId);
    const currentItem = ensureSkillExists(
      await knowledgeNodesRepository.findByIdForProject(id, projectId)
    );

    if (currentItem.archivedAt) {
      throw new AppError("INVALID_REQUEST", "Archived skill cannot be updated.", 409);
    }

    const currentLearningState = currentItem.learningState as SkillLearningState;

    if (!currentItem.isUnlocked) {
      if (updateInput.learningState === currentLearningState) {
        return toApiSkill(currentItem);
      }

      throw new AppError("INVALID_REQUEST", "Locked skill cannot change learningState.", 409);
    }

    if (updateInput.learningState === currentLearningState) {
      return toApiSkill(currentItem);
    }

    const updatedItem = await knowledgeNodesRepository.updateLearningStateByIdForProject(
      id,
      projectId,
      toKnowledgeNodeLearningState(updateInput.learningState)
    );

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
