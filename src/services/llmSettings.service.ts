import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

// —— LLM 运行时配置（原 config/llmRuntime，仅本服务使用，合并进来）——
interface LlmRuntimeConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

let runtimeOverrides: Partial<LlmRuntimeConfig> = {};

function setLlmRuntimeOverrides(overrides: Partial<LlmRuntimeConfig>): void {
  runtimeOverrides = { ...overrides };
}

function getLlmRuntimeOverrides(): Partial<LlmRuntimeConfig> {
  return { ...runtimeOverrides };
}

function getEffectiveLlmConfig(): LlmRuntimeConfig {
  return {
    apiKey: runtimeOverrides.apiKey || env.llmApiKey,
    baseUrl: runtimeOverrides.baseUrl || env.llmBaseUrl,
    model: runtimeOverrides.model || env.llmModel
  };
}

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

  /**
   * 保存 LLM 配置到本地 JSON 与根目录 .env，供 FastAPI AI Engine 读取。
   * Express 不直连 LLM；保存后需重启 FastAPI 才会加载新配置。
   */
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
    await upsertEnvLines(normalized);

    return this.getStatus();
  },

  /**
   * 探测当前运行中的 FastAPI AI Engine 是否可用。
   * 使用 AI Engine 已加载的配置，不会从 Express 直连 LLM。
   */
  async test(_input: LlmSettingsInput): Promise<{ ok: boolean; model: string; text: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.aiEngineTimeoutMs);

    try {
      const response = await fetch(new URL("/chat", env.aiEngineBaseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: "settings_probe",
          message: "Reply with exactly: OK"
        }),
        signal: controller.signal
      });

      const data = (await response.json().catch(() => undefined)) as
        | { reply?: string }
        | undefined;
      const text =
        data && typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "";

      if (!response.ok || !text) {
        throw new AppError(
          "AI_ENGINE_CONNECTION_ERROR",
          "AI Engine 未返回有效回复。若刚保存配置，请先重启 FastAPI 再测试。",
          502
        );
      }

      const effective = getEffectiveLlmConfig();

      return {
        ok: true,
        model: effective.model,
        text: text.slice(0, 120)
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "AI_ENGINE_CONNECTION_ERROR",
        "无法连接 AI Engine。请确认 FastAPI 已启动，且已保存配置并重启服务。",
        502,
        error
      );
    } finally {
      clearTimeout(timeout);
    }
  }
};
