import { NextFunction, Request, Response } from "express";
import { projectsService } from "../services/projects.service";
import { sendSuccess } from "../utils/apiResponse";
import { getDemoUserId } from "../services/demo.service";

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

export async function getProjectById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await projectsService.getById(req.params.projectId));
  } catch (error) {
    next(error);
  }
}

export async function updateProjectById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = await getDemoUserId();
    sendSuccess(
      res,
      await projectsService.updateSetup(req.params.projectId, userId, req.body)
    );
  } catch (error) {
    next(error);
  }
}
