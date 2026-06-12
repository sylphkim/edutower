import { NextFunction, Request, Response } from "express";
import { memoryService } from "../services/memory.service";
import { memorySummarizerService } from "../services/memorySummarizer.service";
import { sendSuccess } from "../utils/apiResponse";

<<<<<<< HEAD
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
=======
export async function listMemoryItems(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await memoryService.list());
}

export async function getMemoryItem(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await memoryService.getById(id);
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429

    sendSuccess(res, await memoryService.getById(id));
  } catch (error) {
    next(error);
  }
}

<<<<<<< HEAD
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
=======
export async function createMemoryItem(req: Request, res: Response): Promise<void> {
  const result = await memoryService.create(req.body);

  sendSuccess(res, result, 201);
}

export async function updateMemoryItem(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await memoryService.update(id, req.body);
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429

    sendSuccess(res, await memoryService.update(id, req.body));
  } catch (error) {
    next(error);
  }
}

<<<<<<< HEAD
export async function deleteMemoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
=======
export async function deleteMemoryItem(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await memoryService.remove(id);
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429

    sendSuccess(res, await memoryService.remove(id));
  } catch (error) {
    next(error);
  }
}

<<<<<<< HEAD
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
=======
export async function createDailySummary(req: Request, res: Response): Promise<void> {
  const result = await memoryService.createDailySummary(req.body);

  sendSuccess(res, result, 201);
>>>>>>> 3a9e1b9d584f6dc27ea3fea40b3a0daffa11a429
}

export async function summarizeMemories(req: Request, res: Response): Promise<void> {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const minCount = typeof req.query.minCount === "string"
    ? Math.max(2, parseInt(req.query.minCount, 10) || 3)
    : 3;

  const result = type
    ? await memorySummarizerService.summarizeByType(type as any, minCount)
    : await memorySummarizerService.summarizeAll(minCount);

  sendSuccess(res, result);
}
