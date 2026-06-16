/**
 * Download Tesseract traineddata for offline OCR (chi_sim + eng).
 * Run: node scripts/download-tessdata.mjs
 */
import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const tessDir = path.join(rootDir, "data", "tessdata", "4.0.0");
const BASE_URL = "https://tessdata.projectnaptha.com/4.0.0";

const LANGS = ["chi_sim", "eng"];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadLang(lang) {
  const target = path.join(tessDir, `${lang}.traineddata.gz`);
  if (await exists(target)) {
    console.log(`[tessdata] skip ${lang} (already present)`);
    return;
  }

  const url = `${BASE_URL}/${lang}.traineddata.gz`;
  console.log(`[tessdata] downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${lang}: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(target, buffer);
  console.log(`[tessdata] saved ${target} (${buffer.length} bytes)`);
}

try {
  await mkdir(tessDir, { recursive: true });
  for (const lang of LANGS) {
    await downloadLang(lang);
  }
  console.log("[tessdata] ready at", tessDir);
} catch (error) {
  console.warn(
    "[tessdata] download skipped:",
    error instanceof Error ? error.message : error
  );
  process.exit(0);
}
