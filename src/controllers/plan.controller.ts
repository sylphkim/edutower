import { Request, Response } from "express";
import { planService } from "../services/plan.service";
import { sendSuccess } from "../utils/apiResponse";

export function generatePlan(_req: Request, res: Response): void {
  sendSuccess(res, planService.generatePlan());
}
