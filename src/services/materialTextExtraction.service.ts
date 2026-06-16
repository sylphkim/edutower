import { readFile } from "node:fs/promises";
import parsePdf = require("pdf-parse/lib/pdf-parse.js");
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { ocrPdfFile, pdfLikelyNeedsOcr } from "./pdfOcr.service";
import { recognizeImageBuffer } from "./ocr.service";

export type ExtractionMethod = "pdf-text" | "pdf-ocr" | "docx" | "image-ocr" | "none";

export interface ExtractionResult {
  /** Extracted text content; empty string if extraction failed or unsupported. */
  text: string;
  /** Whether the original text was truncated to fit the max char limit. */
  truncated: boolean;
  /** Total character count of the original extracted text (before truncation). */
  charCount: number;
  /** How the text was obtained. */
  method: ExtractionMethod;
}

/** Safety cap to prevent huge documents from blowing up memory or DB storage. */
const MAX_EXTRACTED_CHARS = 500_000;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff"
]);

function finalizeResult(text: string, method: ExtractionMethod): ExtractionResult {
  const normalized = text.trim();
  return {
    text: normalized.slice(0, MAX_EXTRACTED_CHARS),
    truncated: normalized.length > MAX_EXTRACTED_CHARS,
    charCount: normalized.length,
    method
  };
}

export const materialTextExtractionService = {
  /**
   * Route to the appropriate extractor based on MIME type.
   * PDF: embedded text first, then offline OCR for scanned pages.
   * Images: offline OCR when enabled.
   */
  async extractFromFile(filePath: string, mimeType: string): Promise<ExtractionResult> {
    if (mimeType === "application/pdf") {
      return this.extractPdf(filePath);
    }

    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      return this.extractDocx(filePath);
    }

    if (IMAGE_MIME_TYPES.has(mimeType)) {
      return this.extractImage(filePath);
    }

    return finalizeResult("", "none");
  },

  /** Extract text from a PDF: pdf-parse first, OCR fallback for scanned PDFs. */
  async extractPdf(filePath: string): Promise<ExtractionResult> {
    let embeddedText = "";
    let pageCount = 1;

    try {
      const buffer = await readFile(filePath);
      const data = await parsePdf(buffer);
      embeddedText = (data.text ?? "").trim();
      pageCount = Math.max(1, Number(data.numpages) || 1);
    } catch (error) {
      logger.warn("PDF embedded text extraction failed; will try OCR if enabled.", {
        filePath,
        error
      });
    }

    const shouldOcr =
      env.ocrEnabled && pdfLikelyNeedsOcr(embeddedText, pageCount);

    if (!shouldOcr) {
      return finalizeResult(embeddedText, embeddedText ? "pdf-text" : "none");
    }

    try {
      logger.info("PDF appears scanned; running offline OCR.", {
        filePath,
        pageCount,
        embeddedChars: embeddedText.length
      });

      const ocrResult = await ocrPdfFile(filePath);
      const mergedText = ocrResult.text || embeddedText;

      if (ocrResult.text) {
        logger.info("PDF OCR completed.", {
          filePath,
          pagesProcessed: ocrResult.pagesProcessed,
          charCount: ocrResult.text.length
        });
        return finalizeResult(mergedText, "pdf-ocr");
      }

      logger.warn("PDF OCR returned no text; keeping embedded layer if any.", { filePath });
      return finalizeResult(embeddedText, embeddedText ? "pdf-text" : "none");
    } catch (error) {
      logger.warn("PDF OCR failed.", { filePath, error });
      return finalizeResult(embeddedText, embeddedText ? "pdf-text" : "none");
    }
  },

  async extractImage(filePath: string): Promise<ExtractionResult> {
    if (!env.ocrEnabled) {
      return finalizeResult("", "none");
    }

    try {
      const buffer = await readFile(filePath);
      const text = await recognizeImageBuffer(buffer);
      return finalizeResult(text, text ? "image-ocr" : "none");
    } catch (error) {
      logger.warn("Image OCR failed.", { filePath, error });
      return finalizeResult("", "none");
    }
  },

  async extractDocx(filePath: string): Promise<ExtractionResult> {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });

      return finalizeResult(result.value ?? "", "docx");
    } catch (error) {
      logger.warn("DOCX text extraction failed.", { filePath, error });
      return finalizeResult("", "none");
    }
  }
};
