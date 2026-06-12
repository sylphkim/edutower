import { NextFunction, Request, Response } from "express";
import { memoryService } from "../services/memory.service";
import { sendSuccess } from "../utils/apiResponse";

export async function listMemoryItems(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await memoryService.list());
  } catch (error) {
    next(error);
  }
}

export async function getMemoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    sendSuccess(res, await memoryService.getById(id));
  } catch (error) {
    next(error);
  }
}

export async function createMemoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await memoryService.create(req.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function updateMemoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    sendSuccess(res, await memoryService.update(id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function deleteMemoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    sendSuccess(res, await memoryService.remove(id));
  } catch (error) {
    next(error);
  }
}

export async function createDailySummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await memoryService.createDailySummary(req.body), 201);
  } catch (error) {
    next(error);
  }
}
