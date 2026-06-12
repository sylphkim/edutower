import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getEffectiveLlmConfig } from "../config/llmRuntime";
import { env } from "../config/env";
import { ChatParams, GenerateTextParams, LLMMessage, LLMResult, LLMUsage } from "../types/llm";
import { AppError, ErrorCode } from "../utils/errors";
import { logger } from "../utils/logger";

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

type RecordLike = Record<string, unknown>;

export class LLMService {
  private client?: OpenAI;

  resetClient(): void {
    this.client = undefined;
  }

  async generateText(params: GenerateTextParams): Promise<LLMResult> {
    const userPrompt = params.userPrompt?.trim();
    if (!userPrompt) {
      throw new AppError("INVALID_REQUEST", "userPrompt is required.", 400);
    }

    const systemPrompt = params.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

    return this.createChatCompletion({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
      jsonMode: params.jsonMode
    });
  }

  async chat(params: ChatParams): Promise<LLMResult> {
    if (!Array.isArray(params.messages) || params.messages.length === 0) {
      throw new AppError("INVALID_REQUEST", "messages cannot be empty.", 400);
    }

    const messages = params.messages.map((message) => ({
      role: message.role,
      content: message.content?.trim()
    }));

    if (messages.some((message) => !message.content)) {
      throw new AppError("INVALID_REQUEST", "message content cannot be empty.", 400);
    }

    return this.createChatCompletion({
      messages,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens
    });
  }

  private getClient(): OpenAI {
    const llmConfig = getEffectiveLlmConfig();

    if (!llmConfig.apiKey) {
      throw new AppError(
        "MISSING_API_KEY",
        "LLM_API_KEY is not configured. You can also set OPENAI_API_KEY for legacy compatibility.",
        503
      );
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: llmConfig.apiKey,
        baseURL: llmConfig.baseUrl,
        timeout: env.llmTimeoutMs,
        maxRetries: 0
      });
    }

    return this.client;
  }

  private async createChatCompletion(params: {
    messages: LLMMessage[];
    temperature?: number;
    maxOutputTokens?: number;
    jsonMode?: boolean;
  }): Promise<LLMResult> {
    try {
      const llmConfig = getEffectiveLlmConfig();
      const response = await this.getClient().chat.completions.create(
        {
          model: llmConfig.model,
          messages: params.messages as ChatCompletionMessageParam[],
          temperature: this.normalizeTemperature(params.temperature),
          max_tokens: this.normalizeMaxOutputTokens(params.maxOutputTokens),
          ...(params.jsonMode
            ? { response_format: { type: "json_object" as const } }
            : {})
        },
        {
          timeout: env.llmTimeoutMs
        }
      );

      return {
        text: this.extractText(response),
        model: this.extractModel(response) ?? getEffectiveLlmConfig().model,
        provider: env.llmProvider,
        usage: this.extractUsage(response),
        raw: response
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const mappedError = this.mapProviderError(error);
      logger.error("LLM request failed.", this.toSafeErrorMeta(error));
      throw mappedError;
    }
  }

  private extractText(response: unknown): string {
    if (!isRecordLike(response) || !Array.isArray(response.choices)) {
      return "";
    }

    return response.choices
      .map((choice) => {
        if (!isRecordLike(choice) || !isRecordLike(choice.message)) {
          return "";
        }

        return typeof choice.message.content === "string" ? choice.message.content : "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  private extractModel(response: unknown): string | undefined {
    if (!isRecordLike(response)) {
      return undefined;
    }

    return typeof response.model === "string" ? response.model : undefined;
  }

  private extractUsage(response: unknown): LLMUsage | undefined {
    if (!isRecordLike(response) || !isRecordLike(response.usage)) {
      return undefined;
    }

    const usage = response.usage;
    const inputTokens = readNumber(usage.prompt_tokens) ?? readNumber(usage.input_tokens);
    const outputTokens = readNumber(usage.completion_tokens) ?? readNumber(usage.output_tokens);
    const totalTokens =
      readNumber(usage.total_tokens) ??
      (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined);

    return {
      inputTokens,
      outputTokens,
      totalTokens
    };
  }

  private normalizeTemperature(value: number | undefined): number {
    if (value === undefined) {
      return DEFAULT_TEMPERATURE;
    }

    if (!Number.isFinite(value)) {
      throw new AppError("INVALID_REQUEST", "temperature must be a valid number.", 400);
    }

    return value;
  }

  private normalizeMaxOutputTokens(value: number | undefined): number {
    if (value === undefined) {
      return env.llmMaxOutputTokens;
    }

    if (!Number.isInteger(value) || value <= 0) {
      throw new AppError("INVALID_REQUEST", "maxOutputTokens must be a positive integer.", 400);
    }

    return value;
  }

  private mapProviderError(error: unknown): AppError {
    if (this.isTimeoutError(error)) {
      return new AppError("LLM_TIMEOUT", "LLM request timed out.", 504, error);
    }

    const status = this.readStatus(error);
    const code = this.readCode(error);
    const message = this.readMessage(error);

    if (status === 401) {
      return this.providerError("LLM_AUTH_FAILED", "LLM provider authentication failed.", 502, error);
    }

    if (status === 404 || this.isModelError(code, message)) {
      return this.providerError("LLM_MODEL_ERROR", "LLM model is unavailable or not found.", 502, error);
    }

    if (status === 429) {
      return this.providerError("LLM_RATE_LIMITED", "LLM provider rate limit was reached.", 429, error);
    }

    if (this.isConnectionError(error)) {
      return this.providerError(
        "LLM_CONNECTION_ERROR",
        "Could not connect to the LLM provider.",
        502,
        error
      );
    }

    return this.providerError(
      "LLM_REQUEST_FAILED",
      "LLM request failed. Please try again later.",
      502,
      error
    );
  }

  private providerError(
    code: Exclude<ErrorCode, "MISSING_API_KEY" | "INVALID_REQUEST" | "INTERNAL_ERROR">,
    message: string,
    statusCode: number,
    cause: unknown
  ): AppError {
    return new AppError(code, message, statusCode, cause);
  }

  private isTimeoutError(error: unknown): boolean {
    const text = this.errorText(error);
    return /timeout|timed out|abort|ETIMEDOUT/i.test(text);
  }

  private isConnectionError(error: unknown): boolean {
    const text = this.errorText(error);
    return /ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNABORTED|network|fetch failed|connection/i.test(
      text
    );
  }

  private isModelError(code: string | undefined, message: string | undefined): boolean {
    return /model|not found|does not exist|invalid model|unknown model/i.test(`${code ?? ""} ${message ?? ""}`);
  }

  private toSafeErrorMeta(error: unknown): Record<string, unknown> {
    return {
      provider: env.llmProvider,
      model: env.llmModel,
      baseURL: env.llmBaseUrl,
      status: this.readStatus(error),
      code: this.readCode(error),
      message: this.readMessage(error)
    };
  }

  private errorText(error: unknown): string {
    return [
      this.readStringField(error, "name"),
      this.readCode(error),
      this.readMessage(error),
      this.readNestedString(error, "cause", "code"),
      this.readNestedString(error, "cause", "message")
    ]
      .filter(Boolean)
      .join(" ");
  }

  private readStatus(error: unknown): number | undefined {
    return (
      this.readNumberField(error, "status") ??
      this.readNestedNumber(error, "response", "status") ??
      this.readNestedNumber(error, "error", "status")
    );
  }

  private readCode(error: unknown): string | undefined {
    return (
      this.readStringField(error, "code") ??
      this.readNestedString(error, "error", "code") ??
      this.readStringField(error, "type") ??
      this.readNestedString(error, "error", "type")
    );
  }

  private readMessage(error: unknown): string | undefined {
    return this.readStringField(error, "message") ?? this.readNestedString(error, "error", "message");
  }

  private readNumberField(value: unknown, key: string): number | undefined {
    return isRecordLike(value) ? readNumber(value[key]) : undefined;
  }

  private readStringField(value: unknown, key: string): string | undefined {
    return isRecordLike(value) && typeof value[key] === "string" ? value[key] : undefined;
  }

  private readNestedNumber(value: unknown, parentKey: string, childKey: string): number | undefined {
    if (!isRecordLike(value) || !isRecordLike(value[parentKey])) {
      return undefined;
    }

    return readNumber(value[parentKey][childKey]);
  }

  private readNestedString(value: unknown, parentKey: string, childKey: string): string | undefined {
    if (!isRecordLike(value) || !isRecordLike(value[parentKey])) {
      return undefined;
    }

    const childValue = value[parentKey][childKey];
    return typeof childValue === "string" ? childValue : undefined;
  }
}

function isRecordLike(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export const llmService = new LLMService();
