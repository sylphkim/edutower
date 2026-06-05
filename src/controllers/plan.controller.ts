import { Request, Response } from "express";
import { planService } from "../services/plan.service";
import { sendSuccess } from "../utils/apiResponse";

export function listPlans(_req: Request, res: Response): void {
  sendSuccess(res, planService.list());
}

export function getPlan(req: Request, res: Response): void {
  const { id } = req.params;
  const result = planService.getById(id);

  sendSuccess(res, result);
}

export function createPlan(req: Request, res: Response): void {
  const result = planService.create(req.body);

  sendSuccess(res, result, 201);
}

export function updatePlan(req: Request, res: Response): void {
  const { id } = req.params;
  const result = planService.update(id, req.body);

  sendSuccess(res, result);
}

export function deletePlan(req: Request, res: Response): void {
  const { id } = req.params;
  const result = planService.remove(id);

  sendSuccess(res, result);
}
