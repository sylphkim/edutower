import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WrongbookTaxonomyEntry } from "../types/wrongbook";
import { logger } from "../utils/logger";

const TAXONOMY_FILE = path.resolve(process.cwd(), "data", "wrongbook-taxonomy.json");

interface StoredTaxonomy {
  subjects: WrongbookTaxonomyEntry[];
  categories: WrongbookTaxonomyEntry[];
}

function emptyTaxonomy(): StoredTaxonomy {
  return { subjects: [], categories: [] };
}

export async function loadWrongbookCustomTaxonomy(): Promise<StoredTaxonomy> {
  try {
    await access(TAXONOMY_FILE);
    const raw = await readFile(TAXONOMY_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredTaxonomy>;

    return {
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : []
    };
  } catch {
    return emptyTaxonomy();
  }
}

export async function saveWrongbookCustomTaxonomy(data: StoredTaxonomy): Promise<void> {
  try {
    await mkdir(path.dirname(TAXONOMY_FILE), { recursive: true });
    await writeFile(TAXONOMY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    logger.error("Failed to persist wrongbook taxonomy.", error);
  }
}
