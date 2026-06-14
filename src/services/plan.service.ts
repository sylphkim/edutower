import {
  projectsRepository,
  type CreateStudyTaskRecordInput,
  type StudyProjectWithPlan
} from "../repositories/projects.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import type { ProjectStatus, StudyTaskType } from "../generated/prisma/client";
import type {
  CreatePlanInput,
  PlanDay,
  PlanItem,
  PlanStatus,
  PlanTask,
  PlanTaskStatus,
  PlanTaskType,
  UpdatePlanInput
} from "../types/plan";
import { AppError } from "../utils/errors";
import { getDemoProjectId, getDemoUserId } from "./demo.service";

const VALID_PLAN_STATUSES: PlanStatus[] = ["draft", "active", "completed"];
const VALID_TASK_TYPES: PlanTaskType[] = [
  "read_material",
  "practice_quiz",
  "review_wrongbook",
  "master_skill"
];
const VALID_TASK_STATUSES: PlanTaskStatus[] = ["todo", "in_progress", "done"];

function ensurePlanExists(item: StudyProjectWithPlan | null): StudyProjectWithPlan {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Plan item not found.", 404);
  }

  return item;
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

      if (task.materialId !== undefined && typeof task.materialId !== "string") {
        throw new AppError("INVALID_REQUEST", "task materialId must be a string.", 400);
      }

      if (task.skillId !== undefined && typeof task.skillId !== "string") {
        throw new AppError("INVALID_REQUEST", "task skillId must be a string.", 400);
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

function toProjectStatus(status: PlanStatus): ProjectStatus {
  if (status === "active") {
    return "active";
  }

  if (status === "completed") {
    return "completed";
  }

  return "planning";
}

function toPlanStatus(status: ProjectStatus): PlanStatus {
  if (status === "active") {
    return "active";
  }

  if (status === "completed" || status === "archived") {
    return "completed";
  }

  return "draft";
}

function toTaskRecords(days: PlanDay[]): CreateStudyTaskRecordInput[] {
  return days.flatMap((day) =>
    day.tasks.map((task, index) => ({
      id: task.id.trim(),
      title: task.title.trim(),
      type: task.type as StudyTaskType,
      day: day.day,
      order: index,
      knowledgeNodeId: task.skillId,
      materialId: task.materialId,
      status: task.status
    }))
  );
}

async function ensureMaterialsBelongToUser(
  materialIds: Array<string | undefined>,
  userId: string
): Promise<void> {
  const uniqueMaterialIds = Array.from(
    new Set(materialIds.filter((id): id is string => Boolean(id)))
  );

  if (uniqueMaterialIds.length === 0) {
    return;
  }

  const existingIds = await projectsRepository.findExistingMaterialIdsForUser(
    uniqueMaterialIds,
    userId
  );
  const existingIdSet = new Set(existingIds);

  if (uniqueMaterialIds.some((id) => !existingIdSet.has(id))) {
    throw new AppError("INVALID_REQUEST", "materialIds must reference existing user materials.", 400);
  }
}

async function ensureTaskSkillsExist(tasks: CreateStudyTaskRecordInput[]): Promise<void> {
  const skillIds = Array.from(
    new Set(tasks.map((task) => task.knowledgeNodeId).filter((id): id is string => Boolean(id)))
  );

  const count = await knowledgeNodesRepository.countByIds(skillIds);

  if (count !== skillIds.length) {
    throw new AppError(
      "INVALID_REQUEST",
      "task skillId must reference an existing skill.",
      400
    );
  }
}

function toApiPlan(project: StudyProjectWithPlan): PlanItem {
  const taskDays = new Map<number, PlanTask[]>();

  for (const task of project.studyTasks) {
    if (task.day === null) {
      continue;
    }

    const tasks = taskDays.get(task.day) ?? [];
    tasks.push({
      id: task.id,
      title: task.title,
      type: task.type as PlanTaskType,
      materialId: task.materialId ?? undefined,
      skillId: task.knowledgeNodeId ?? undefined,
      status: task.status as PlanTaskStatus
    });
    taskDays.set(task.day, tasks);
  }

  const days = Array.from(taskDays.entries())
    .sort(([leftDay], [rightDay]) => leftDay - rightDay)
    .map(([day, tasks]) => ({
      day,
      title: `Day ${day}`,
      tasks
    }));

  return {
    id: project.id,
    title: project.title,
    goal: project.goal || undefined,
    materialIds: project.materialLinks.map((link) => link.materialId),
    skillIds: project.knowledgeNodes.map((node) => node.id),
    days,
    status: toPlanStatus(project.status),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export const planService = {
  async list(): Promise<{ items: PlanItem[] }> {
    const userId = await getDemoUserId();
    await getDemoProjectId();
    const items = await projectsRepository.listByUser(userId);

    return {
      items: items.map(toApiPlan)
    };
  },

  async getById(id: string): Promise<PlanItem> {
    const userId = await getDemoUserId();
    const item = ensurePlanExists(await projectsRepository.findByIdForUser(id, userId));

    return toApiPlan(item);
  },

  async create(input: CreatePlanInput): Promise<PlanItem> {
    ensureValidCreateInput(input);

    const userId = await getDemoUserId();
    const materialIds = input.materialIds ? [...input.materialIds] : [];
    const tasks = toTaskRecords(input.days ?? []);
    await ensureMaterialsBelongToUser(
      [...materialIds, ...tasks.map((task) => task.materialId)],
      userId
    );

    if (tasks.some((task) => task.knowledgeNodeId)) {
      await ensureTaskSkillsExist(tasks);
    }

    const item = await projectsRepository.createPlan({
      userId,
      title: input.title.trim(),
      goal: input.goal ?? "",
      status: "planning",
      materialIds,
      tasks
    });

    return toApiPlan(item);
  },

  async update(id: string, input: UpdatePlanInput): Promise<PlanItem> {
    ensureValidUpdateInput(input);

    const userId = await getDemoUserId();
    const currentItem = ensurePlanExists(await projectsRepository.findByIdForUser(id, userId));
    const tasks = input.days !== undefined ? toTaskRecords(input.days) : undefined;
    const materialIds = input.materialIds !== undefined ? [...input.materialIds] : undefined;

    if (materialIds) {
      await ensureMaterialsBelongToUser(
        [...materialIds, ...(tasks ?? []).map((task) => task.materialId)],
        userId
      );
    } else if (tasks) {
      await ensureMaterialsBelongToUser(
        tasks.map((task) => task.materialId),
        userId
      );
    }

    if (tasks) {
      await ensureTaskSkillsExist(tasks);
    }

    const updatedItem = await projectsRepository.updatePlan(id, {
      userId,
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      goal: input.goal ?? currentItem.goal,
      status: input.status !== undefined ? toProjectStatus(input.status) : currentItem.status,
      materialIds,
      tasks
    });

    return toApiPlan(updatedItem);
  },

  async remove(id: string): Promise<PlanItem> {
    const userId = await getDemoUserId();
    const currentItem = ensurePlanExists(await projectsRepository.findByIdForUser(id, userId));
    await projectsRepository.deleteByIdForUser(id, userId);

    return toApiPlan(currentItem);
  }
};
