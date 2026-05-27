import { Request, Response } from "express";
import { memoryService } from "../services/memory.service";
import { sendSuccess } from "../utils/apiResponse";

export function getMemoryProfile(_req: Request, res: Response): void {
  sendSuccess(res, memoryService.getProfile());
}

export function updateMemoryProfile(_req: Request, res: Response): void {
  sendSuccess(res, memoryService.updateProfile());
}
