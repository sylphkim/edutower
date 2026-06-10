import { NextFunction, Request, Response } from "express";
import { skillsService } from "../services/skills.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

function getOptionalQueryString(req: Request, key: string): string | undefined {
  const value = req.query[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError("INVALID_REQUEST", `${key} must be a string.`, 400);
  }

  return value;
}

export async function listSkills(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await skillsService.list());
  } catch (error) {
    next(error);
  }
}

export async function getSkillTree(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const projectId = getOptionalQueryString(req, "projectId");
    const includeArchived = getOptionalQueryString(req, "includeArchived") === "true";

    sendSuccess(res, await skillsService.getTree({ projectId, includeArchived }));
  } catch (error) {
    next(error);
  }
}

export async function getSkill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await skillsService.getById(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createSkill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await skillsService.create(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateSkill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await skillsService.update(id, req.body);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteSkill(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await skillsService.remove(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
