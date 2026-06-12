import dotenv from "dotenv";

dotenv.config();

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  port: parseInteger(process.env.PORT, 3000),
  aiEngineBaseUrl: process.env.AI_ENGINE_BASE_URL?.trim() || "http://127.0.0.1:8000",
  aiEngineTimeoutMs: parseInteger(process.env.AI_ENGINE_TIMEOUT_MS, 30000),

  databaseUrl: process.env.DATABASE_URL?.trim() || ""
};
