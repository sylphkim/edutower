import { NextFunction, Request, Response } from "express";
import { llmSettingsService } from "../services/llmSettings.service";
import { sendSuccess } from "../utils/apiResponse";

export async function getLlmSettingsStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, llmSettingsService.getStatus());
  } catch (error) {
    next(error);
  }
}

export async function saveLlmSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await llmSettingsService.save(req.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function testLlmSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await llmSettingsService.test(req.body));
  } catch (error) {
    next(error);
  }
}
