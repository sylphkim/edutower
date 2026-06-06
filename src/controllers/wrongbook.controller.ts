import { NextFunction, Request, Response } from "express";
import { wrongbookService } from "../services/wrongbook.service";
import { sendSuccess } from "../utils/apiResponse";

export async function listWrongbookItems(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await wrongbookService.list());
  } catch (error) {
    next(error);
  }
}

export async function createWrongbookSubject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = wrongbookService.createSubject(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function createWrongbookCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = wrongbookService.createCategory(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function deleteWrongbookSubject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await wrongbookService.removeSubject(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteWrongbookCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await wrongbookService.removeCategory(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getWrongbookItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await wrongbookService.getById(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createWrongbookItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await wrongbookService.create(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateWrongbookItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await wrongbookService.update(id, req.body);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteWrongbookItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await wrongbookService.remove(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
