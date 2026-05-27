import { Request, Response } from "express";
import { skillsService } from "../services/skills.service";
import { sendSuccess } from "../utils/apiResponse";

export function getSkillTree(_req: Request, res: Response): void {
  sendSuccess(res, skillsService.getTree());
}
