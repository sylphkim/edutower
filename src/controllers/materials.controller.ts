import { Request, Response } from "express";
import { materialsService } from "../services/materials.service";
import { sendSuccess } from "../utils/apiResponse";

export function listMaterials(_req: Request, res: Response): void {
  sendSuccess(res, materialsService.list());
}

export function getMaterial(req: Request, res: Response): void {
  const { id } = req.params;
  const result = materialsService.getById(id);

  sendSuccess(res, result);
}

export function createMaterial(req: Request, res: Response): void {
  const result = materialsService.create(req.body);

  sendSuccess(res, result, 201);
}

export function updateMaterial(req: Request, res: Response): void {
  const { id } = req.params;
  const result = materialsService.update(id, req.body);

  sendSuccess(res, result);
}

export function deleteMaterial(req: Request, res: Response): void {
  const { id } = req.params;
  const result = materialsService.remove(id);

  sendSuccess(res, result);
}
