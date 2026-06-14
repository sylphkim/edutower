import type { StudyProject } from "../generated/prisma/client";
import {
  projectsRepository,
  type UpdateProjectSetupRecord
} from "../repositories/projects.repository";
import type { ProjectDetail, ProjectSetupInput } from "../types/project";
import { AppError } from "../utils/errors";
import { getDemoProjectId, getDemoUserId } from "./demo.service";

const MAX_DAILY_MINUTES = 1440;

function ensureNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError("INVALID_REQUEST", `${field} must be a non-empty string.`, 400);
  }

  return value.trim();
}

function ensureOptionalDate(value: unknown, field: string): Date | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError("INVALID_REQUEST", `${field} must be an ISO date string or null.`, 400);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("INVALID_REQUEST", `${field} is not a valid date.`, 400);
  }

  return date;
}

function ensureOptionalPositiveInt(value: unknown, field: string): number | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_DAILY_MINUTES
  ) {
    throw new AppError(
      "INVALID_REQUEST",
      `${field} must be an integer between 1 and ${MAX_DAILY_MINUTES}, or null.`,
      400
    );
  }

  return value;
}

function buildSetupRecord(input: ProjectSetupInput): UpdateProjectSetupRecord {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  const record: UpdateProjectSetupRecord = {};

  if (input.title !== undefined) {
    record.title = ensureNonEmptyString(input.title, "title");
  }

  if (input.subject !== undefined) {
    record.subject = ensureNonEmptyString(input.subject, "subject");
  }

  if (input.goal !== undefined) {
    if (typeof input.goal !== "string") {
      throw new AppError("INVALID_REQUEST", "goal must be a string.", 400);
    }
    record.goal = input.goal.trim();
  }

  if (input.targetScore !== undefined) {
    if (input.targetScore !== null && typeof input.targetScore !== "string") {
      throw new AppError("INVALID_REQUEST", "targetScore must be a string or null.", 400);
    }
    record.targetScore = input.targetScore === null ? null : input.targetScore.trim() || null;
  }

  if (input.deadline !== undefined) {
    record.deadline = ensureOptionalDate(input.deadline, "deadline");
  }

  if (input.startDate !== undefined) {
    record.startDate = ensureOptionalDate(input.startDate, "startDate");
  }

  if (input.dailyMinutes !== undefined) {
    record.dailyMinutes = ensureOptionalPositiveInt(input.dailyMinutes, "dailyMinutes");
  }

  if (input.goalConfirmed !== undefined) {
    if (typeof input.goalConfirmed !== "boolean") {
      throw new AppError("INVALID_REQUEST", "goalConfirmed must be a boolean.", 400);
    }
    record.goalConfirmedAt = input.goalConfirmed ? new Date() : null;
  }

  return record;
}

function toDetail(project: StudyProject): ProjectDetail {
  return {
    id: project.id,
    title: project.title,
    subject: project.subject,
    goal: project.goal,
    targetScore: project.targetScore ?? null,
    startDate: project.startDate ? project.startDate.toISOString() : null,
    deadline: project.deadline ? project.deadline.toISOString() : null,
    dailyMinutes: project.dailyMinutes ?? null,
    status: project.status,
    goalConfirmedAt: project.goalConfirmedAt ? project.goalConfirmedAt.toISOString() : null,
    planConfirmedAt: project.planConfirmedAt ? project.planConfirmedAt.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export const projectsService = {
  /** 读取当前（demo）项目的设置详情。 */
  async getCurrent(): Promise<ProjectDetail> {
    const userId = await getDemoUserId();
    const projectId = await getDemoProjectId();
    const project = await projectsRepository.findSetupByIdForUser(projectId, userId);

    if (!project) {
      throw new AppError("INVALID_REQUEST", "Current project not found.", 404);
    }

    return toDetail(project);
  },

  /** 写入当前（demo）项目的设置：目标/目标分/DDL/每日时长/开始日 + 目标确认。 */
  async updateCurrentSetup(input: ProjectSetupInput): Promise<ProjectDetail> {
    const record = buildSetupRecord(input);
    const userId = await getDemoUserId();
    const projectId = await getDemoProjectId();
    const project = await projectsRepository.updateSetup(projectId, userId, record);

    return toDetail(project);
  }
};
