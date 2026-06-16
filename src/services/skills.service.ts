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
  UpdateSkillInput,
  UpdateSkillLearningStateInput
} from "../types/skills";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { conceptMappingService } from "./conceptMapping.service";
import { getDemoProjectId, getDemoUserId } from "./demo.service";

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

function ensureValidSkillUpdateInput(
  input: unknown
): UpdateSkillInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  const body = input as Record<string, unknown>;
  const result: UpdateSkillInput = {};

  if (body.learningState !== undefined) {
    if (
      typeof body.learningState !== "string" ||
      !VALID_LEARNING_STATES.includes(body.learningState as SkillLearningState)
    ) {
      throw new AppError(
        "INVALID_REQUEST",
        `learningState must be one of: ${VALID_LEARNING_STATES.join(", ")}.`,
        400
      );
    }
    result.learningState = body.learningState as SkillLearningState;
  }

  if (body.mastery !== undefined) {
    ensureValidMastery(body.mastery as number);
    result.mastery = body.mastery as number;
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new AppError("INVALID_REQUEST", "title must be a non-empty string.", 400);
    }
    result.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      throw new AppError("INVALID_REQUEST", "description must be a string.", 400);
    }
    result.description = body.description;
  }

  if (Object.keys(result).length === 0) {
    throw new AppError(
      "INVALID_REQUEST",
      "PATCH body must contain at least one updatable field: learningState, mastery, title, description.",
      400
    );
  }

  return result;
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

function buildVisiblePrerequisiteMap(
  items: KnowledgeNodeWithPrerequisites[],
  visibleItemMap: Map<string, KnowledgeNodeWithPrerequisites>
): Map<string, string[]> {
  return new Map(
    items.map((item) => [
      item.id,
      item.prerequisiteLinks
        .map((link) => link.prerequisiteId)
        .filter((prerequisiteId) => visibleItemMap.has(prerequisiteId))
        .sort((left, right) => left.localeCompare(right))
    ])
  );
}

function assertAcyclicDependencyGraph(
  prerequisiteMap: Map<string, string[]>
): void {
  const visitState = new Map<string, "visiting" | "visited">();

  const visit = (id: string): void => {
    const currentState = visitState.get(id);

    if (currentState === "visiting") {
      throw new AppError(
        "INVALID_REQUEST",
        "Skill dependency graph contains a cycle.",
        409
      );
    }

    if (currentState === "visited") {
      return;
    }

    visitState.set(id, "visiting");
    for (const prerequisiteId of prerequisiteMap.get(id) ?? []) {
      visit(prerequisiteId);
    }
    visitState.set(id, "visited");
  };

  for (const id of prerequisiteMap.keys()) {
    visit(id);
  }
}

function buildPrerequisiteRiskMap(
  items: KnowledgeNodeWithPrerequisites[],
  visibleItemMap: Map<string, KnowledgeNodeWithPrerequisites>,
  prerequisiteMap: Map<string, string[]>
): Map<string, string[]> {
  const riskMemo = new Map<string, string[]>();

  const collectRiskPrerequisiteIds = (id: string): string[] => {
    const memoizedRiskIds = riskMemo.get(id);

    if (memoizedRiskIds) {
      return memoizedRiskIds;
    }

    const riskPrerequisiteIds = new Set<string>();

    for (const prerequisiteId of prerequisiteMap.get(id) ?? []) {
      const prerequisite = visibleItemMap.get(prerequisiteId);

      if (!prerequisite) {
        continue;
      }

      if (prerequisite.learningState !== "mastered") {
        riskPrerequisiteIds.add(prerequisiteId);
      }

      for (const upstreamRiskId of collectRiskPrerequisiteIds(prerequisiteId)) {
        riskPrerequisiteIds.add(upstreamRiskId);
      }
    }

    const sortedRiskPrerequisiteIds = [...riskPrerequisiteIds].sort((left, right) =>
      left.localeCompare(right)
    );
    riskMemo.set(id, sortedRiskPrerequisiteIds);

    return sortedRiskPrerequisiteIds;
  };

  return new Map(
    items.map((item) => [
      item.id,
      item.isUnlocked ? collectRiskPrerequisiteIds(item.id) : []
    ])
  );
}

function toTreeSkill(
  item: KnowledgeNodeWithPrerequisites,
  prerequisiteMap: Map<string, string[]>,
  riskMap: Map<string, string[]>
): SkillTreeItem {
  const visiblePrerequisiteIds = prerequisiteMap.get(item.id) ?? [];
  const riskPrerequisiteIds = riskMap.get(item.id) ?? [];

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
    const prerequisiteMap = buildVisiblePrerequisiteMap(items, visibleItemMap);
    assertAcyclicDependencyGraph(prerequisiteMap);
    const riskMap = buildPrerequisiteRiskMap(items, visibleItemMap, prerequisiteMap);
    const treeItems = items.map((item) => toTreeSkill(item, prerequisiteMap, riskMap));

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
    const updateInput = ensureValidSkillUpdateInput(input);
    const projectId = await resolveProjectId(options.projectId);

    // If learningState is provided, always go through the unlock-aware path first
    if (updateInput.learningState !== undefined) {
      const result =
        await knowledgeNodesRepository.updateLearningStateAndUnlockDirectDependentsByIdForProject(
          id,
          projectId,
          toKnowledgeNodeLearningState(updateInput.learningState)
        );

      switch (result.status) {
        case "not_found":
          throw new AppError("INVALID_REQUEST", "Skill item not found.", 404);
        case "archived":
          throw new AppError("INVALID_REQUEST", "Archived skill cannot be updated.", 409);
        case "locked":
          throw new AppError("INVALID_REQUEST", "Locked skill cannot change learningState.", 409);
        case "success":
          break; // proceed to apply additional fields below
      }

      // Apply any additional fields (mastery, title, description) on top
      const hasExtraFields =
        updateInput.mastery !== undefined ||
        updateInput.title !== undefined ||
        updateInput.description !== undefined;

      if (hasExtraFields) {
        await knowledgeNodesRepository.updateByIdForProject(id, projectId, {
          ...(updateInput.mastery !== undefined ? { mastery: updateInput.mastery } : {}),
          ...(updateInput.title !== undefined ? { title: updateInput.title } : {}),
          ...(updateInput.description !== undefined
            ? { description: updateInput.description }
            : {})
        });
      }

      // Sync mastery to concept ledger if learningState is "mastered"
      if (updateInput.learningState === "mastered") {
        const userId = await getDemoUserId();
        await conceptMappingService
          .recordNodeMastery(userId, projectId, [id])
          .catch((error) => {
            logger.warn("Failed to sync skill mastery to concept ledger.", error);
          });
      }

      const item = await knowledgeNodesRepository.findByIdForProject(id, projectId);
      return toApiSkill(ensureSkillExists(item));
    }

    // No learningState: general update only (mastery, title, description)
    const item = await knowledgeNodesRepository.updateByIdForProject(id, projectId, {
      ...(updateInput.mastery !== undefined ? { mastery: updateInput.mastery } : {}),
      ...(updateInput.title !== undefined ? { title: updateInput.title } : {}),
      ...(updateInput.description !== undefined
        ? { description: updateInput.description }
        : {})
    });

    return toApiSkill(item);
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
