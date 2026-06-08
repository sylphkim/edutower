import { NextFunction, Request, Response } from "express";
import { materialFoldersService } from "../services/materialFolders.service";
import { sendSuccess } from "../utils/apiResponse";

export async function listMaterialFolders(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await materialFoldersService.list());
  } catch (error) {
    next(error);
  }
}

export async function createMaterialFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await materialFoldersService.create(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateMaterialFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await materialFoldersService.update(id, req.body);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteMaterialFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await materialFoldersService.remove(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
