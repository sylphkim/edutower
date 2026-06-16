import path from "node:path";
import { NextFunction, Request, Response } from "express";
import { materialsService } from "../services/materials.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

function readUploadFolderId(value: unknown): string | null | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function toProjectStoragePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

export async function listMaterialChunks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await materialsService.listChunks(req.query.limit));
  } catch (error) {
    next(error);
  }
}

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

export async function uploadMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError("INVALID_REQUEST", "Material file is required.", 400);
    }

    const result = await materialsService.createUploaded({
      folderId: readUploadFolderId(req.body?.folderId),
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: toProjectStoragePath(req.file.path)
    });

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

export async function downloadMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { stream, downloadName, mimeType } = await materialsService.getDownloadPayload(id);

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );

    stream.on("error", (error) => {
      next(error);
    });

    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function reparseMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await materialsService.reparseExtractedText(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
