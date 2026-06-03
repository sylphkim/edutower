import { Request, Response } from "express";
import { skillsService } from "../services/skills.service";
import { sendSuccess } from "../utils/apiResponse";

export function listSkills(_req: Request, res: Response): void {
  sendSuccess(res, skillsService.list());
}

export function getSkillTree(_req: Request, res: Response): void {
  sendSuccess(res, skillsService.getTree());
}

export function getSkill(req: Request, res: Response): void {
  const { id } = req.params;
  const result = skillsService.getById(id);

  sendSuccess(res, result);
}

export function createSkill(req: Request, res: Response): void {
  const result = skillsService.create(req.body);

  sendSuccess(res, result, 201);
}

export function updateSkill(req: Request, res: Response): void {
  const { id } = req.params;
  const result = skillsService.update(id, req.body);

  sendSuccess(res, result);
}

export function deleteSkill(req: Request, res: Response): void {
  const { id } = req.params;
  const result = skillsService.remove(id);

  sendSuccess(res, result);
}
