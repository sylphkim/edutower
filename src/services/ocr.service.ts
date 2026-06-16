import path from "node:path";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const OCR_LANGS = "chi_sim+eng";

let workerPromise: Promise<Worker> | null = null;
let workerRefCount = 0;

function resolveTessdataLangPath(): string {
  const configured = env.ocrLangPath?.trim();
  if (configured) {
    return configured;
  }

  return path.resolve(process.cwd(), "data", "tessdata", "4.0.0");
}

async function createOcrWorker(): Promise<Worker> {
  const langPath = resolveTessdataLangPath();

  const worker = await createWorker(OCR_LANGS, 1, {
    langPath,
    gzip: true,
    cacheMethod: "none"
  });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO
  });

  return worker;
}

async function acquireWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }

  workerRefCount += 1;
  return workerPromise;
}

function releaseWorker(): void {
  workerRefCount = Math.max(0, workerRefCount - 1);
}

export async function recognizeImageBuffer(image: Buffer): Promise<string> {
  const worker = await acquireWorker();

  try {
    const result = await worker.recognize(image);
    return normalizeOcrText(result.data.text ?? "");
  } catch (error) {
    logger.warn("OCR recognition failed.", { error });
    return "";
  } finally {
    releaseWorker();
  }
}

export async function shutdownOcrWorker(): Promise<void> {
  if (!workerPromise) {
    return;
  }

  const worker = await workerPromise;
  workerPromise = null;
  workerRefCount = 0;
  await worker.terminate();
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
