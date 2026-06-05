import { Request, Response } from "express";
import { memoryService } from "../services/memory.service";
import { sendSuccess } from "../utils/apiResponse";

export function listMemoryItems(_req: Request, res: Response): void {
  sendSuccess(res, memoryService.list());
}

export function getMemoryItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = memoryService.getById(id);

  sendSuccess(res, result);
}

export function createMemoryItem(req: Request, res: Response): void {
  const result = memoryService.create(req.body);

  sendSuccess(res, result, 201);
}

export function updateMemoryItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = memoryService.update(id, req.body);

  sendSuccess(res, result);
}

export function deleteMemoryItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = memoryService.remove(id);

  sendSuccess(res, result);
}

export function createDailySummary(req: Request, res: Response): void {
  const result = memoryService.createDailySummary(req.body);

  sendSuccess(res, result, 201);
}
