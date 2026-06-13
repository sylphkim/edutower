import { env } from "./env";

export interface LlmRuntimeConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

let runtimeOverrides: Partial<LlmRuntimeConfig> = {};

export function setLlmRuntimeOverrides(overrides: Partial<LlmRuntimeConfig>): void {
  runtimeOverrides = { ...overrides };
}

export function getLlmRuntimeOverrides(): Partial<LlmRuntimeConfig> {
  return { ...runtimeOverrides };
}

export function getEffectiveLlmConfig(): LlmRuntimeConfig {
  return {
    apiKey: runtimeOverrides.apiKey || env.llmApiKey,
    baseUrl: runtimeOverrides.baseUrl || env.llmBaseUrl,
    model: runtimeOverrides.model || env.llmModel
  };
}
