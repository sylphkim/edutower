import { NextFunction, Request, Response } from "express";
import { planService } from "../services/plan.service";
import { sendSuccess } from "../utils/apiResponse";

export async function listPlans(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await planService.list());
  } catch (error) {
    next(error);
  }
}

export async function getPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await planService.getById(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await planService.create(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function updatePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await planService.update(id, req.body);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deletePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await planService.remove(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
