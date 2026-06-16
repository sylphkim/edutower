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

export async function designPlanFromSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const force = Boolean((body as { force?: unknown }).force);
    sendSuccess(
      res,
      await planProposalsService.designApplyAndConfirm(req.params.projectId, { force })
    );
  } catch (error) {
    next(error);
  }
}
