import { NextFunction, Request, Response } from "express";
import { conceptsService } from "../services/concepts.service";
import { sendSuccess } from "../utils/apiResponse";

export async function listConcepts(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await conceptsService.listGlobal();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
