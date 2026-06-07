import { NextFunction, Request, Response } from "express";
import { materialsService } from "../services/materials.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

export async function listMaterials(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { folderId: rawFolderId } = req.query;

    if (rawFolderId !== undefined && typeof rawFolderId !== "string") {
      throw new AppError(
        "INVALID_REQUEST",
        "folderId query parameter must be a string.",
        400
      );
    }

    const folderId = rawFolderId;

    sendSuccess(res, await materialsService.list({ folderId }));
  } catch (error) {
    next(error);
  }
}

export async function getMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await materialsService.getById(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await materialsService.create(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await materialsService.update(id, req.body);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await materialsService.remove(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
