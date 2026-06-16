import { readFile } from "node:fs/promises";
import { logger } from "../utils/logger";

export interface ExtractionResult {
  /** Extracted text content; empty string if extraction failed or unsupported. */
  text: string;
  /** Whether the original text was truncated to fit the max char limit. */
  truncated: boolean;
  /** Total character count of the original extracted text (before truncation). */
  charCount: number;
}

/** Safety cap to prevent huge documents from blowing up memory or DB storage. */
const MAX_EXTRACTED_CHARS = 500_000;

export const materialTextExtractionService = {
  /**
   * Route to the appropriate extractor based on MIME type.
   * Returns empty text for unsupported types (e.g. images) without throwing.
   */
  async extractFromFile(
    filePath: string,
    mimeType: string
  ): Promise<ExtractionResult> {
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

    // Images, plain text, and unknown types: no extraction needed / not supported
    return { text: "", truncated: false, charCount: 0 };
  },

  /** Extract text from a PDF file using pdf-parse (dynamic import). */
  async extractPdf(filePath: string): Promise<ExtractionResult> {
    try {
      // Dynamic import: pdf-parse uses CJS `export =`, which becomes `{ default: fn }` in ESM
      const pdfParseModule = await import("pdf-parse");
      const parsePdf = (
        pdfParseModule as unknown as { default: typeof import("pdf-parse") }
      ).default;
      const buffer = await readFile(filePath);
      const data = await parsePdf(buffer);

      const text = (data.text ?? "").slice(0, MAX_EXTRACTED_CHARS);

      return {
        text,
        truncated: (data.text?.length ?? 0) > MAX_EXTRACTED_CHARS,
        charCount: data.text?.length ?? 0
      };
    } catch (error) {
      logger.warn("PDF text extraction failed.", { filePath, error });
      return { text: "", truncated: false, charCount: 0 };
    }
  },

  /** Extract text from a DOCX/DOC file using mammoth (dynamic import). */
  async extractDocx(filePath: string): Promise<ExtractionResult> {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });

      const text = (result.value ?? "").slice(0, MAX_EXTRACTED_CHARS);

      return {
        text,
        truncated: (result.value?.length ?? 0) > MAX_EXTRACTED_CHARS,
        charCount: result.value?.length ?? 0
      };
    } catch (error) {
      logger.warn("DOCX text extraction failed.", { filePath, error });
      return { text: "", truncated: false, charCount: 0 };
    }
  }
};
