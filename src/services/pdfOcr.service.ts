import { pdf } from "pdf-to-img";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { recognizeImageBuffer } from "./ocr.service";

export interface PdfOcrResult {
  text: string;
  pageCount: number;
  pagesProcessed: number;
}

export async function ocrPdfFile(filePath: string): Promise<PdfOcrResult> {
  const scale = env.ocrPdfScale;
  const maxPages = env.ocrPdfMaxPages;

  const document = await pdf(filePath, { scale });
  const pageTexts: string[] = [];
  let pageIndex = 0;
  let pagesProcessed = 0;

  for await (const image of document) {
    pageIndex += 1;
    if (pageIndex > maxPages) {
      logger.info("PDF OCR stopped at page limit.", { filePath, maxPages });
      break;
    }

    pagesProcessed += 1;
    const pageText = await recognizeImageBuffer(Buffer.from(image));
    if (pageText) {
      pageTexts.push(pageText);
    }
  }

  const text = pageTexts.join("\n\n").trim();

  return {
    text,
    pageCount: pageIndex,
    pagesProcessed
  };
}

export function pdfLikelyNeedsOcr(extractedText: string, pageCount: number): boolean {
  const trimmed = extractedText.trim();
  const pages = Math.max(1, pageCount);

  if (!trimmed) {
    return true;
  }

  const minTotalChars = Math.max(80, pages * 20);
  if (trimmed.length < minTotalChars) {
    return true;
  }

  const charsPerPage = trimmed.length / pages;
  return charsPerPage < 25;
}
