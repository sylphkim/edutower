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
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
  llmTimeoutMs: parseInteger(process.env.LLM_TIMEOUT_MS, 30000),
  llmMaxOutputTokens: parseInteger(process.env.LLM_MAX_OUTPUT_TOKENS, 1000)
};
