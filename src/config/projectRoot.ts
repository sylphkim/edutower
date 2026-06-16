import path from "node:path";

/**
 * Project root resolved from this config file's location at compile time.
 * `src/config` → `src` → project root.
 */
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
