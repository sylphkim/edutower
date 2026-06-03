import { mockSkillItems } from "../mock/skills";
import type {
  CreateSkillInput,
  SkillItem,
  SkillStatus,
  SkillTreeItem,
  UpdateSkillInput
} from "../types/skills";
import { AppError } from "../utils/errors";

const VALID_STATUSES: SkillStatus[] = ["locked", "available", "in_progress", "mastered"];

// 先用内存数组保存技能记录，以后可以替换成数据库查询。
const skillItems: SkillItem[] = mockSkillItems.map((item) => ({ ...item }));
let nextSkillNumber = skillItems.length + 1;

function createSkillId(): string {
  const id = `skill-${String(nextSkillNumber).padStart(3, "0")}`;
  nextSkillNumber += 1;
  return id;
}

// 找不到 id 时直接抛错，避免调用方静默失败。
function findIndexById(id: string): number {
  const index = skillItems.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new AppError("INVALID_REQUEST", "Skill item not found.", 404);
  }

  return index;
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
  list(): { items: SkillItem[] } {
    return {
      items: skillItems
    };
  },

  getById(id: string): SkillItem {
    return skillItems[findIndexById(id)];
  },

  getTree(): { items: SkillTreeItem[] } {
    return {
      items: buildTree(skillItems)
    };
  },

  create(input: CreateSkillInput): SkillItem {
    ensureValidCreateInput(input);

    const now = new Date().toISOString();
    const item: SkillItem = {
      id: createSkillId(),
      title: input.title.trim(),
      description: input.description,
      parentId: input.parentId,
      prerequisites: input.prerequisites ? [...input.prerequisites] : [],
      status: input.status ?? "available",
      mastery: input.mastery ?? 0,
      order: input.order ?? skillItems.length + 1,
      createdAt: now,
      updatedAt: now
    };

    skillItems.push(item);
    return item;
  },

  update(id: string, input: UpdateSkillInput): SkillItem {
    ensureValidUpdateInput(id, input);

    const index = findIndexById(id);
    const currentItem = skillItems[index];
    const updatedItem: SkillItem = {
      ...currentItem,
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      description: input.description ?? currentItem.description,
      parentId: input.parentId !== undefined ? input.parentId ?? undefined : currentItem.parentId,
      prerequisites:
        input.prerequisites !== undefined ? [...input.prerequisites] : currentItem.prerequisites,
      status: input.status ?? currentItem.status,
      mastery: input.mastery ?? currentItem.mastery,
      order: input.order ?? currentItem.order,
      updatedAt: new Date().toISOString()
    };

    skillItems[index] = updatedItem;
    return updatedItem;
  },

  remove(id: string): SkillItem {
    const index = findIndexById(id);
    const [removedItem] = skillItems.splice(index, 1);

    return removedItem;
  }
};
