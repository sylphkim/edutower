import { NextFunction, Request, Response } from "express";
import { planVersionsService } from "../services/planVersions.service";
import { sendSuccess } from "../utils/apiResponse";

export async function listPlanVersions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await planVersionsService.list(req.params.projectId));
  } catch (error) {
    next(error);
  }
}

export async function getCurrentPlanVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await planVersionsService.getCurrent(req.params.projectId));
  } catch (error) {
    next(error);
  }
}

export async function getPlanVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      await planVersionsService.getById(req.params.projectId, req.params.versionId)
    );
  } catch (error) {
    next(error);
  }
}

export async function createPlanVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await planVersionsService.create(req.params.projectId, req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function updatePlanVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await planVersionsService.update(
      req.params.projectId,
      req.params.versionId,
      req.body
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function confirmPlanVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await planVersionsService.confirm(
      req.params.projectId,
      req.params.versionId
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function revisePlanVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await planVersionsService.revise(
      req.params.projectId,
      req.params.versionId
    );
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}
