import { NextFunction, Request, Response } from "express";
import { planProposalsService } from "../services/planProposals.service";
import { sendSuccess } from "../utils/apiResponse";

export async function generatePlanProposal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await planProposalsService.generateFromAi(req.params.projectId));
  } catch (error) {
    next(error);
  }
}

export async function applyPlanProposal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await planProposalsService.apply(req.params.projectId, req.body);
    sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
  } catch (error) {
    next(error);
  }
}
