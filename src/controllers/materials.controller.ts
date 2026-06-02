import { Request, Response } from "express";
import { materialsService } from "../services/materials.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { MaterialSourceType } from "../types/edutower";

const VALID_SOURCE_TYPES: MaterialSourceType[] = ["pdf", "doc", "text", "link"];

export function uploadMaterial(req: Request, res: Response): void {
  const { title, sourceType } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    sendError(res, 400, "INVALID_REQUEST", "title is required and must be a non-empty string.");
    return;
  }

  if (!VALID_SOURCE_TYPES.includes(sourceType)) {
    sendError(
      res,
      400,
      "INVALID_REQUEST",
      `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}.`
    );
    return;
  }

  const result = materialsService.createMaterial({
    title: title.trim(),
    sourceType
  });
  sendSuccess(res, result, 202);
}

export function listMaterialChunks(_req: Request, res: Response): void {
  sendSuccess(res, materialsService.listChunks());
}
