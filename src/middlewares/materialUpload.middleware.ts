import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { PROJECT_ROOT } from "../config/projectRoot";
import { AppError } from "../utils/errors";

export const MATERIAL_UPLOAD_FIELD_NAME = "file";
export const MATERIAL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const MATERIAL_UPLOAD_DIR = path.join(PROJECT_ROOT, "uploads", "materials");

const ALLOWED_MIME_TYPES_BY_EXTENSION: Record<string, ReadonlySet<string>> = {
  ".pdf": new Set(["application/pdf"]),
  ".doc": new Set(["application/msword"]),
  ".docx": new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]),
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".png": new Set(["image/png"])
};

class UnsupportedMaterialFileTypeError extends Error {
  constructor() {
    super("Unsupported material file type.");
    this.name = "UnsupportedMaterialFileTypeError";
  }
}

function getLowercaseExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    mkdir(MATERIAL_UPLOAD_DIR, { recursive: true })
      .then(() => callback(null, MATERIAL_UPLOAD_DIR))
      .catch((error: Error) => callback(error, MATERIAL_UPLOAD_DIR));
  },

  filename(_req, file, callback) {
    const extension = getLowercaseExtension(file.originalname);
    callback(null, `${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MATERIAL_UPLOAD_MAX_BYTES,
    files: 1
  },
  fileFilter(_req, file, callback) {
    const extension = getLowercaseExtension(file.originalname);
    const allowedMimeTypes = ALLOWED_MIME_TYPES_BY_EXTENSION[extension];

    if (!allowedMimeTypes?.has(file.mimetype)) {
      callback(new UnsupportedMaterialFileTypeError());
      return;
    }

    callback(null, true);
  }
});

const materialUploadSingleFile = upload.single(MATERIAL_UPLOAD_FIELD_NAME);

function toMaterialUploadAppError(error: unknown): AppError | undefined {
  if (error instanceof UnsupportedMaterialFileTypeError) {
    return new AppError("INVALID_REQUEST", error.message, 400, error);
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new AppError(
        "INVALID_REQUEST",
        "Material file size must be 20 MB or less.",
        400,
        error
      );
    }

    return new AppError("INVALID_REQUEST", "Invalid material upload request.", 400, error);
  }

  return undefined;
}

export function materialUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  materialUploadSingleFile(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    next(toMaterialUploadAppError(error) ?? error);
  });
}
