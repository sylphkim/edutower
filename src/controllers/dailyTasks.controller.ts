import { NextFunction, Request, Response } from "express";
import { dailyTasksService } from "../services/dailyTasks.service";
import { sendSuccess } from "../utils/apiResponse";

export async function ensureToday(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { record, created } = await dailyTasksService.ensureToday(req.params.projectId);
    sendSuccess(res, record, created ? 201 : 200);
  } catch (error) {
    next(error);
  }
}

export async function getToday(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await dailyTasksService.getToday(req.params.projectId));
  } catch (error) {
    next(error);
  }
}

export async function regenerateToday(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await dailyTasksService.regenerateToday(req.params.projectId));
  } catch (error) {
    next(error);
  }
}

export async function closeToday(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await dailyTasksService.closeToday(req.params.projectId));
  } catch (error) {
    next(error);
  }
}

export async function listSheets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      await dailyTasksService.listSheets(req.params.projectId, {
        date: req.query.date,
        limit: req.query.limit
      })
    );
  } catch (error) {
    next(error);
  }
}

export async function updateDailyTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      await dailyTasksService.updateTaskStatus(
        req.params.projectId,
        req.params.taskId,
        req.body
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function decideSummarySuggestions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      await dailyTasksService.decideSummary(
        req.params.projectId,
        req.params.summaryId,
        req.body
      )
    );
  } catch (error) {
    next(error);
  }
}
