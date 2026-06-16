import { createReadStream, type ReadStream } from "node:fs";
import { access, unlink } from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "../config/projectRoot";
import { prisma } from "../lib/prisma";
import { materialsRepository } from "../repositories/materials.repository";
import { materialFoldersRepository } from "../repositories/materialFolders.repository";
import type {
  Material,
  MaterialCategory,
  MaterialOrigin,
  MaterialStatus as PrismaMaterialStatus
} from "../generated/prisma/client";
import type {
  CreateMaterialInput,
  CreateUploadedMaterialInput,
  MaterialListQuery,
  MaterialItem,
  MaterialSource,
  MaterialSourceType,
  MaterialStatus,
  MaterialType,
  UpdateMaterialInput
} from "../types/materials";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { getDemoProjectId, getDemoUserId } from "./demo.service";
import { materialTextExtractionService } from "./materialTextExtraction.service";

const VALID_TYPES: MaterialType[] = ["slides", "photo", "board", "outline", "note", "exam", "other"];
const VALID_SOURCES: MaterialSource[] = ["uploaded", "manual", "mock"];
const VALID_STATUSES: MaterialStatus[] = ["pending", "processing", "ready", "failed"];
const MATERIAL_UPLOAD_ROOT = path.join(PROJECT_ROOT, "uploads", "materials");

function ensureMaterialExists(item: Material | null): Material {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Material item not found.", 404);
  }

  return item;
}

function ensureValidFolderId(value: unknown, fieldName: string): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      `${fieldName} must be a non-empty string or null.`,
      400
    );
  }
}

function normalizeListFolderId(folderId: string | null | undefined): string | null | undefined {
  if (folderId === "unclassified") {
    return null;
  }

  return folderId;
}

async function ensureFolderBelongsToUser(
  folderId: string,
  userId: string
): Promise<void> {
  const folder = await materialFoldersRepository.findById(folderId);

  if (!folder || folder.userId !== userId) {
    throw new AppError(
      "INVALID_REQUEST",
      "folderId must reference an existing material folder.",
      400
    );
  }
}

async function resolveFolderIdForUser(
  folderId: string | null | undefined,
  userId: string
): Promise<string | null | undefined> {
  if (folderId === undefined || folderId === null) {
    return folderId;
  }

  await ensureFolderBelongsToUser(folderId, userId);

  return folderId;
}

function ensureValidCreateInput(input: CreateMaterialInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
    throw new AppError("INVALID_REQUEST", "title is required and must be a non-empty string.", 400);
  }

  if (!VALID_TYPES.includes(input.type)) {
    throw new AppError("INVALID_REQUEST", `type must be one of: ${VALID_TYPES.join(", ")}.`, 400);
  }

  if (input.source !== undefined && !VALID_SOURCES.includes(input.source)) {
    throw new AppError(
      "INVALID_REQUEST",
      `source must be one of: ${VALID_SOURCES.join(", ")}.`,
      400
    );
  }

  if (input.summary !== undefined && typeof input.summary !== "string") {
    throw new AppError("INVALID_REQUEST", "summary must be a string.", 400);
  }

  ensureValidFolderId(input.folderId, "folderId");
}

function ensureValidUpdateInput(input: UpdateMaterialInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (
    input.title !== undefined &&
    (typeof input.title !== "string" || !input.title.trim())
  ) {
    throw new AppError("INVALID_REQUEST", "title must be a non-empty string.", 400);
  }

  if (input.type !== undefined && !VALID_TYPES.includes(input.type)) {
    throw new AppError("INVALID_REQUEST", `type must be one of: ${VALID_TYPES.join(", ")}.`, 400);
  }

  if (input.status !== undefined && !VALID_STATUSES.includes(input.status)) {
    throw new AppError(
      "INVALID_REQUEST",
      `status must be one of: ${VALID_STATUSES.join(", ")}.`,
      400
    );
  }

  if (input.summary !== undefined && typeof input.summary !== "string") {
    throw new AppError("INVALID_REQUEST", "summary must be a string.", 400);
  }

  ensureValidFolderId(input.folderId, "folderId");
}

function toMaterialCategory(type: MaterialType): MaterialCategory {
  return type as MaterialCategory;
}

function toMaterialOrigin(source: MaterialSource): MaterialOrigin {
  return source as MaterialOrigin;
}

function toMaterialStatus(status: MaterialStatus): PrismaMaterialStatus {
  return status as PrismaMaterialStatus;
}

function getUploadedMaterialExtension(input: CreateUploadedMaterialInput): string {
  return path.extname(input.originalFileName).toLowerCase();
}

function getUploadedMaterialTitle(originalFileName: string): string {
  const extension = path.extname(originalFileName);

  if (!extension) {
    return originalFileName;
  }

  return originalFileName.slice(0, -extension.length);
}

function inferUploadedMaterialCategory(extension: string): MaterialCategory {
  if (extension === ".pdf") {
    return "slides";
  }

  if (extension === ".doc" || extension === ".docx") {
    return "note";
  }

  return "photo";
}

function inferUploadedMaterialSourceType(extension: string): MaterialSourceType {
  if (extension === ".pdf") {
    return "pdf";
  }

  if (extension === ".doc" || extension === ".docx") {
    return "doc";
  }

  return "image";
}

async function cleanupUploadedFile(storagePath: string, cause: unknown): Promise<void> {
  try {
    await unlink(storagePath);
  } catch (error) {
    logger.warn("Failed to clean up uploaded material file after upload error.", {
      storagePath,
      cleanupError: error,
      originalError: cause
    });
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function resolveStoredMaterialFilePath(item: Material): string | null {
  if (!item.storagePath?.trim() || !item.storedFileName?.trim()) {
    return null;
  }

  const filePath = path.resolve(process.cwd(), item.storagePath);
  const pathWithinUploadRoot = path.relative(MATERIAL_UPLOAD_ROOT, filePath);

  if (
    !pathWithinUploadRoot ||
    pathWithinUploadRoot.startsWith("..") ||
    path.isAbsolute(pathWithinUploadRoot)
  ) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Stored material file path is invalid.",
      500
    );
  }

  return filePath;
}

async function deleteStoredMaterialFileIfNeeded(item: Material): Promise<void> {
  const filePath = resolveStoredMaterialFilePath(item);

  if (!filePath) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return;
    }

    throw new AppError("INTERNAL_ERROR", "Failed to delete material file.", 500, error);
  }
}

function toApiMaterial(item: Material): MaterialItem {
  return {
    id: item.id,
    title: item.title,
    type: item.category as MaterialType,
    source: item.origin as MaterialSource,
    status: item.status as MaterialStatus,
    folderId: item.folderId,
    sourceType: item.sourceType,
    originalFileName: item.originalFileName,
    storedFileName: item.storedFileName,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    storagePath: item.storagePath,
    summary: item.summary ?? undefined,
    extractedText: item.extractedText,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function splitTextToChunks(text: string, chunkSize: number): string[] {
  // Split by paragraphs first
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current && current.length + para.length > chunkSize) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If no paragraph breaks produced chunks, fall back to raw text
  if (chunks.length === 0 && text.trim()) {
    return [text.trim()];
  }

  // Split any oversized single chunk by sentence boundaries
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= chunkSize * 1.5) {
      result.push(chunk);
    } else {
      const sentences = chunk.split(/(?<=[。！？.!?])\s*/);
      let sentenceChunk = "";
      for (const s of sentences) {
        if (sentenceChunk && sentenceChunk.length + s.length > chunkSize) {
          result.push(sentenceChunk.trim());
          sentenceChunk = s;
        } else {
          sentenceChunk += s;
        }
      }
      if (sentenceChunk.trim()) {
        result.push(sentenceChunk.trim());
      }
    }
  }

  return result;
}

export interface MaterialChunkItem {
  order: number;
  materialId: string;
  title: string;
  text: string;
}

export const materialsService = {
  async list(query: MaterialListQuery = {}): Promise<{ items: MaterialItem[] }> {
    ensureValidFolderId(query.folderId, "folderId");

    const userId = await getDemoUserId();
    const listFolderId = normalizeListFolderId(query.folderId);
    const folderId = await resolveFolderIdForUser(listFolderId, userId);
    const items = await materialsRepository.listByUser(userId, {
      folderId
    });

    return {
      items: items.map(toApiMaterial)
    };
  },

  async getById(id: string): Promise<MaterialItem> {
    const userId = await getDemoUserId();
    const item = ensureMaterialExists(await materialsRepository.findByIdForUser(id, userId));

    return toApiMaterial(item);
  },

  async create(input: CreateMaterialInput): Promise<MaterialItem> {
    ensureValidCreateInput(input);

    const userId = await getDemoUserId();
    const folderId = await resolveFolderIdForUser(input.folderId, userId);
    const item = await materialsRepository.create({
      userId,
      title: input.title.trim(),
      category: toMaterialCategory(input.type),
      origin: toMaterialOrigin(input.source ?? "manual"),
      status: toMaterialStatus("ready"),
      folderId: folderId ?? null,
      summary: input.summary
    });

    // Auto-link to demo project so material appears in AI chat context
    try {
      const projectId = await getDemoProjectId();
      await prisma.projectMaterial.create({
        data: { projectId, materialId: item.id }
      });
    } catch (linkError) {
      // Link may already exist; log and continue
      logger.warn("Failed to auto-link manual material to demo project.", {
        materialId: item.id,
        error: linkError
      });
    }

    return toApiMaterial(item);
  },

  async createUploaded(input: CreateUploadedMaterialInput): Promise<MaterialItem> {
    try {
      const userId = await getDemoUserId();
      const folderId = await resolveFolderIdForUser(input.folderId, userId);
      const extension = getUploadedMaterialExtension(input);
      const item = await materialsRepository.create({
        userId,
        title: getUploadedMaterialTitle(input.originalFileName),
        category: inferUploadedMaterialCategory(extension),
        origin: "uploaded",
        status: "ready",
        folderId: folderId ?? null,
        sourceType: inferUploadedMaterialSourceType(extension),
        originalFileName: input.originalFileName,
        storedFileName: input.storedFileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        summary: undefined
      });

      // ── 自动提取文档文本 ──
      const filePath = path.resolve(process.cwd(), input.storagePath);
      let updatedItem = item;
      try {
        const extraction = await materialTextExtractionService.extractFromFile(
          filePath,
          input.mimeType
        );
        if (extraction.text) {
          updatedItem = await materialsRepository.updateByIdForUser(item.id, userId, {
            extractedText: extraction.text
          });
          logger.info("Text extracted from uploaded material.", {
            materialId: item.id,
            originalFileName: input.originalFileName,
            charCount: extraction.charCount,
            truncated: extraction.truncated,
            method: extraction.method
          });
        }
      } catch (extractionError) {
        logger.warn("Text extraction failed for uploaded material.", {
          materialId: item.id,
          originalFileName: input.originalFileName,
          error: extractionError
        });
      }

      // ── 自动关联到 demo project ──
      try {
        const projectId = await getDemoProjectId();
        await prisma.projectMaterial.create({
          data: { projectId, materialId: item.id }
        });
      } catch (linkError) {
        logger.error("Failed to auto-link material to demo project — material will be invisible to AI.", {
          materialId: item.id,
          error: linkError
        });
      }

      return toApiMaterial(updatedItem);
    } catch (error) {
      await cleanupUploadedFile(input.storagePath, error);
      throw error;
    }
  },

  async update(id: string, input: UpdateMaterialInput): Promise<MaterialItem> {
    ensureValidUpdateInput(input);

    const userId = await getDemoUserId();
    const currentItem = ensureMaterialExists(
      await materialsRepository.findByIdForUser(id, userId)
    );
    const folderId = await resolveFolderIdForUser(input.folderId, userId);

    const updatedItem = await materialsRepository.updateByIdForUser(id, userId, {
      title: input.title !== undefined ? input.title.trim() : currentItem.title,
      category:
        input.type !== undefined ? toMaterialCategory(input.type) : currentItem.category,
      status:
        input.status !== undefined
          ? toMaterialStatus(input.status)
          : currentItem.status,
      ...(folderId !== undefined ? { folderId } : {}),
      summary: input.summary ?? currentItem.summary ?? undefined,
      extractedText:
        input.extractedText !== undefined
          ? input.extractedText
          : currentItem.extractedText
    });

    return toApiMaterial(updatedItem);
  },

  async remove(id: string): Promise<MaterialItem> {
    const userId = await getDemoUserId();
    const currentItem = ensureMaterialExists(
      await materialsRepository.findByIdForUser(id, userId)
    );

    await deleteStoredMaterialFileIfNeeded(currentItem);

    const removedItem = await materialsRepository.deleteById(currentItem.id);

    return toApiMaterial(removedItem);
  },

  async getDownloadPayload(id: string): Promise<{
    stream: ReadStream;
    downloadName: string;
    mimeType: string;
  }> {
    const userId = await getDemoUserId();
    const item = ensureMaterialExists(await materialsRepository.findByIdForUser(id, userId));
    const filePath = resolveStoredMaterialFilePath(item);

    if (!filePath) {
      throw new AppError("INVALID_REQUEST", "This material has no downloadable file.", 400);
    }

    try {
      await access(filePath);
    } catch {
      throw new AppError("INVALID_REQUEST", "Material file is missing on disk.", 404);
    }

    return {
      stream: createReadStream(filePath),
      downloadName: item.originalFileName?.trim() || item.title,
      mimeType: item.mimeType?.trim() || "application/octet-stream"
    };
  },

  async listChunks(limitRaw?: unknown): Promise<{ items: MaterialChunkItem[] }> {
    const userId = await getDemoUserId();
    const limit =
      typeof limitRaw === "string" && /^\d+$/.test(limitRaw)
        ? Math.min(200, Math.max(1, Number.parseInt(limitRaw, 10)))
        : 80;

    const materials = await materialsRepository.listByUser(userId);
    const chunks: MaterialChunkItem[] = [];
    const CHUNK_TARGET_BYTES = 1500;

    for (const item of materials) {
      // Priority: extractedText (parsed from PDF/DOCX) > summary (user-written)
      const sourceText = item.extractedText?.trim() || item.summary?.trim();
      if (!sourceText) {
        continue;
      }

      for (const text of splitTextToChunks(sourceText, CHUNK_TARGET_BYTES)) {
        chunks.push({
          order: chunks.length + 1,
          materialId: item.id,
          title: item.title,
          text
        });

        if (chunks.length >= limit) {
          return { items: chunks };
        }
      }
    }

    return { items: chunks };
  },

  /** Re-extract text from the original uploaded file. Useful when a previous
   *  extraction failed or the file was replaced. */
  async reparseExtractedText(
    id: string
  ): Promise<MaterialItem & { extractionMethod?: string }> {
    const userId = await getDemoUserId();
    const item = ensureMaterialExists(
      await materialsRepository.findByIdForUser(id, userId)
    );

    if (!item.storagePath?.trim() || !item.mimeType?.trim()) {
      throw new AppError(
        "INVALID_REQUEST",
        "Material has no uploaded file to re-parse.",
        400
      );
    }

    const filePath = path.resolve(process.cwd(), item.storagePath);
    const extraction = await materialTextExtractionService.extractFromFile(
      filePath,
      item.mimeType
    );

    const updated = await materialsRepository.updateByIdForUser(id, userId, {
      extractedText: extraction.text || null
    });

    logger.info("Material text re-parsed.", {
      materialId: id,
      charCount: extraction.charCount,
      method: extraction.method
    });

    return {
      ...toApiMaterial(updated),
      extractionMethod: extraction.method
    };
  }
};
