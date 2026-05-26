import dotenv from "dotenv";

dotenv.config();

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readApiKey(...values: Array<string | undefined>): string {
  const apiKey = values.map((value) => value?.trim()).find(Boolean) ?? "";
  const placeholders = new Set(["your_api_key_here", "your_openai_api_key_here"]);

  return placeholders.has(apiKey) ? "" : apiKey;
}

export const env = {
  port: parseInteger(process.env.PORT, 3000),
  llmProvider: process.env.LLM_PROVIDER?.trim() || "openai",
  llmApiKey: readApiKey(process.env.LLM_API_KEY, process.env.OPENAI_API_KEY),
  llmModel: process.env.LLM_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
  llmBaseUrl:
    process.env.LLM_BASE_URL?.trim() || process.env.OPENAI_BASE_URL?.trim() || undefined,
  llmTimeoutMs: parseInteger(process.env.LLM_TIMEOUT_MS, 30000),
  llmMaxOutputTokens: parseInteger(process.env.LLM_MAX_OUTPUT_TOKENS, 1000)
};
