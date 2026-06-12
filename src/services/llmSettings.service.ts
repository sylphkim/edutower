import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import {
  getEffectiveLlmConfig,
  getLlmRuntimeOverrides,
  setLlmRuntimeOverrides
} from "../config/llmRuntime";
import { env } from "../config/env";
import { llmService } from "./llm.service";
import { AppError } from "../utils/errors";

export interface LlmSettingsInput {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface LlmSettingsStatus {
  configured: boolean;
  source: "env" | "local" | "none";
  maskedKey: string | null;
  baseUrl: string | null;
  model: string | null;
}

const SETTINGS_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "local-llm-config.json");
const ENV_FILE = path.join(process.cwd(), ".env");

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function normalizeInput(input: LlmSettingsInput): LlmSettingsInput {
  return {
    apiKey: input.apiKey?.trim() || undefined,
    baseUrl: input.baseUrl?.trim() || undefined,
    model: input.model?.trim() || undefined
  };
}

async function ensureSettingsDir(): Promise<void> {
  await mkdir(SETTINGS_DIR, { recursive: true });
}

async function readStoredSettings(): Promise<LlmSettingsInput> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as LlmSettingsInput;
    return normalizeInput(parsed);
  } catch {
    return {};
  }
}

async function writeStoredSettings(input: LlmSettingsInput): Promise<void> {
  await ensureSettingsDir();
  await writeFile(SETTINGS_FILE, `${JSON.stringify(input, null, 2)}\n`, "utf8");
}

async function upsertEnvLines(input: LlmSettingsInput): Promise<void> {
  if (!input.apiKey && !input.baseUrl && !input.model) {
    return;
  }

  let content = "";
  try {
    content = await readFile(ENV_FILE, "utf8");
  } catch {
    content = "";
  }

  const lines = content.length ? content.split(/\r?\n/) : [];
  const updates: Record<string, string> = {};

  if (input.apiKey) updates.LLM_API_KEY = input.apiKey;
  if (input.baseUrl) updates.LLM_BASE_URL = input.baseUrl;
  if (input.model) updates.LLM_MODEL = input.model;

  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^${key}=.*$`);
    const nextLine = `${key}=${value}`;
    const index = lines.findIndex((line) => pattern.test(line));

    if (index >= 0) {
      lines[index] = nextLine;
    } else {
      lines.push(nextLine);
    }
  }

  const normalized = lines.join("\n").replace(/\n*$/, "\n");
  await writeFile(ENV_FILE, normalized, "utf8");
}

export const llmSettingsService = {
  async hydrateFromDisk(): Promise<void> {
    const stored = await readStoredSettings();
    setLlmRuntimeOverrides({
      apiKey: stored.apiKey,
      baseUrl: stored.baseUrl,
      model: stored.model
    });
  },

  getStatus(): LlmSettingsStatus {
    const effective = getEffectiveLlmConfig();
    const configured = Boolean(effective.apiKey);
    const overrides = getLlmRuntimeOverrides();
    let source: LlmSettingsStatus["source"] = "none";

    if (configured) {
      source = overrides.apiKey ? "local" : "env";
    }

    return {
      configured,
      source,
      maskedKey: configured ? maskApiKey(effective.apiKey) : null,
      baseUrl: effective.baseUrl ?? null,
      model: effective.model ?? null
    };
  },

  async save(input: LlmSettingsInput): Promise<LlmSettingsStatus> {
    const normalized = normalizeInput(input);

    if (!normalized.apiKey) {
      throw new AppError("INVALID_REQUEST", "apiKey is required.", 400);
    }

    setLlmRuntimeOverrides({
      apiKey: normalized.apiKey,
      baseUrl: normalized.baseUrl,
      model: normalized.model
    });
    await writeStoredSettings(normalized);
    await upsertEnvLines(normalized).catch(() => {});
    llmService.resetClient();

    return this.getStatus();
  },

  async test(input: LlmSettingsInput): Promise<{ ok: boolean; model: string; text: string }> {
    const normalized = normalizeInput(input);

    if (!normalized.apiKey) {
      throw new AppError("INVALID_REQUEST", "apiKey is required.", 400);
    }

    const client = new OpenAI({
      apiKey: normalized.apiKey,
      baseURL: normalized.baseUrl,
      timeout: env.llmTimeoutMs,
      maxRetries: 0
    });

    const response = await client.chat.completions.create({
      model: normalized.model || env.llmModel,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 16,
      temperature: 0
    });

    const text = response.choices[0]?.message?.content?.trim() || "OK";

    return {
      ok: true,
      model: response.model || normalized.model || env.llmModel,
      text
    };
  }
};
