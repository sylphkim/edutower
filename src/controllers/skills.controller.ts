import { NextFunction, Request, Response } from "express";
import { skillsService } from "../services/skills.service";
import { sendSuccess } from "../utils/apiResponse";

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
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await skillsService.getTree());
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
