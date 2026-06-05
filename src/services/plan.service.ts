import { mockPlanItems } from "../mock/plan";
import type {
  CreatePlanInput,
  PlanDay,
  PlanItem,
  PlanStatus,
  PlanTaskStatus,
  PlanTaskType,
  UpdatePlanInput
} from "../types/plan";
import { AppError } from "../utils/errors";

const VALID_PLAN_STATUSES: PlanStatus[] = ["draft", "active", "completed"];
const VALID_TASK_TYPES: PlanTaskType[] = [
  "read_material",
  "practice_quiz",
  "review_wrongbook",
  "master_skill"
];
const VALID_TASK_STATUSES: PlanTaskStatus[] = ["todo", "in_progress", "done"];

// 先用内存数组保存学习计划，以后可以替换成数据库查询。
const planItems: PlanItem[] = mockPlanItems.map((item) => ({
  ...item,
  materialIds: [...item.materialIds],
  skillIds: [...item.skillIds],
  days: copyDays(item.days)
}));
let nextPlanNumber = planItems.length + 1;

function createPlanId(): string {
  const id = `plan-${String(nextPlanNumber).padStart(3, "0")}`;
  nextPlanNumber += 1;
  return id;
}

// 找不到 id 时直接抛错，避免调用方静默失败。
function findIndexById(id: string): number {
  const index = planItems.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new AppError("INVALID_REQUEST", "Plan item not found.", 404);
  }

  return index;
}

function copyDays(days: PlanDay[]): PlanDay[] {
  return days.map((day) => ({
    ...day,
    tasks: day.tasks.map((task) => ({ ...task }))
  }));
}

function ensureStringArray(value: string[], fieldName: string): void {
  if (!Array.isArray(value)) {
    throw new AppError("INVALID_REQUEST", `${fieldName} must be an array.`, 400);
  }

  if (value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new AppError("INVALID_REQUEST", `${fieldName} must contain non-empty strings.`, 400);
  }
}

function ensureValidDays(days: PlanDay[]): void {
  if (!Array.isArray(days)) {
    throw new AppError("INVALID_REQUEST", "days must be an array.", 400);
  }

  for (const day of days) {
    if (!day || typeof day !== "object") {
      throw new AppError("INVALID_REQUEST", "Each day must be an object.", 400);
    }

    if (typeof day.day !== "number" || !Number.isFinite(day.day)) {
      throw new AppError("INVALID_REQUEST", "day must be a number.", 400);
    }

    if (!day.title || typeof day.title !== "string" || !day.title.trim()) {
      throw new AppError("INVALID_REQUEST", "day title must be a non-empty string.", 400);
    }

    if (!Array.isArray(day.tasks)) {
      throw new AppError("INVALID_REQUEST", "tasks must be an array.", 400);
    }

    for (const task of day.tasks) {
      if (!task || typeof task !== "object") {
        throw new AppError("INVALID_REQUEST", "Each task must be an object.", 400);
      }

      if (!task.id || typeof task.id !== "string" || !task.id.trim()) {
        throw new AppError("INVALID_REQUEST", "task id must be a non-empty string.", 400);
      }

      if (!task.title || typeof task.title !== "string" || !task.title.trim()) {
        throw new AppError("INVALID_REQUEST", "task title must be a non-empty string.", 400);
      }

      if (!VALID_TASK_TYPES.includes(task.type)) {
        throw new AppError(
          "INVALID_REQUEST",
          `task type must be one of: ${VALID_TASK_TYPES.join(", ")}.`,
          400
        );
      }

      if (!VALID_TASK_STATUSES.includes(task.status)) {
        throw new AppError(
          "INVALID_REQUEST",
          `task status must be one of: ${VALID_TASK_STATUSES.join(", ")}.`,
          400
        );
      }
    }
  }
}

function ensureValidCreateInput(input: CreatePlanInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
    throw new AppError("INVALID_REQUEST", "title is required and must be a non-empty string.", 400);
  }

  if (input.goal !== undefined && typeof input.goal !== "string") {
    throw new AppError("INVALID_REQUEST", "goal must be a string.", 400);
  }

  if (input.materialIds !== undefined) {
    ensureStringArray(input.materialIds, "materialIds");
  }

  if (input.skillIds !== undefined) {
    ensureStringArray(input.skillIds, "skillIds");
  }

  if (input.days !== undefined) {
    ensureValidDays(input.days);
  }
}

function ensureValidUpdateInput(input: UpdatePlanInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim())) {
    throw new AppError("INVALID_REQUEST", "title must be a non-empty string.", 400);
  }

  if (input.goal !== undefined && typeof input.goal !== "string") {
    throw new AppError("INVALID_REQUEST", "goal must be a string.", 400);
  }

  if (input.materialIds !== undefined) {
    ensureStringArray(input.materialIds, "materialIds");
  }

  if (input.skillIds !== undefined) {
    ensureStringArray(input.skillIds, "skillIds");
  }

  if (input.days !== undefined) {
    ensureValidDays(input.days);
  }

  if (input.status !== undefined && !VALID_PLAN_STATUSES.includes(input.status)) {
    throw new AppError(
      "INVALID_REQUEST",
      `status must be one of: ${VALID_PLAN_STATUSES.join(", ")}.`,
      400
    );
  }
}

export const planService = {
  list(): { items: PlanItem[] } {
    return {
      items: planItems
    };
  },

  getById(id: string): PlanItem {
    return planItems[findIndexById(id)];
  },

  create(input: CreatePlanInput): PlanItem {
    ensureValidCreateInput(input);

    const now = new Date().toISOString();
    const item: PlanItem = {
      id: createPlanId(),
      title: input.title.trim(),
      goal: input.goal,
      materialIds: input.materialIds ? [...input.materialIds] : [],
      skillIds: input.skillIds ? [...input.skillIds] : [],
      days: input.days ? copyDays(input.days) : [],
      status: "draft",
      createdAt: now,
      updatedAt: now
    };

    planItems.push(item);
    return item;
  },

  update(id: string, input: UpdatePlanInput): PlanItem {
    ensureValidUpdateInput(input);

    const index = findIndexById(id);
    const currentItem = planItems[index];
    const updatedItem: PlanItem = {
      ...currentItem,
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      goal: input.goal ?? currentItem.goal,
      materialIds:
        input.materialIds !== undefined ? [...input.materialIds] : currentItem.materialIds,
      skillIds: input.skillIds !== undefined ? [...input.skillIds] : currentItem.skillIds,
      days: input.days !== undefined ? copyDays(input.days) : currentItem.days,
      status: input.status ?? currentItem.status,
      updatedAt: new Date().toISOString()
    };

    planItems[index] = updatedItem;
    return updatedItem;
  },

  remove(id: string): PlanItem {
    const index = findIndexById(id);
    const [removedItem] = planItems.splice(index, 1);

    return removedItem;
  }
};
