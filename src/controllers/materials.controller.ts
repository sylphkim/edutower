import { Request, Response } from "express";
import { materialsService } from "../services/materials.service";
import { sendSuccess } from "../utils/apiResponse";

export function uploadMaterial(_req: Request, res: Response): void {
  sendSuccess(res, materialsService.createUploadPlaceholder(), 202);
}

export function listMaterialChunks(_req: Request, res: Response): void {
  sendSuccess(res, materialsService.listChunks());
}
