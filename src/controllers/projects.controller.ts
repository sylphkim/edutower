import { NextFunction, Request, Response } from "express";
import { projectsService } from "../services/projects.service";
import { sendSuccess } from "../utils/apiResponse";

export async function getCurrentProject(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await projectsService.getCurrent());
  } catch (error) {
    next(error);
  }
}

export async function updateCurrentProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await projectsService.updateCurrentSetup(req.body));
  } catch (error) {
    next(error);
  }
}
