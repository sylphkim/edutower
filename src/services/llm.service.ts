import OpenAI from "openai";
import { env } from "../config/env";
import { ChatParams, GenerateTextParams, LLMMessage, LLMResult, LLMUsage } from "../types/llm";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

const DEFAULT_TEMPERATURE = 0.7;

type OpenAIResponseInputMessage = {
  role: Exclude<LLMMessage["role"], "system">;
  content: string;
};

type RecordLike = Record<string, unknown>;

export class LLMService {
  private client?: OpenAI;

  async generateText(params: GenerateTextParams): Promise<LLMResult> {
    const userPrompt = params.userPrompt?.trim();
    if (!userPrompt) {
      throw new AppError("INVALID_REQUEST", "userPrompt is required.", 400);
    }

    return this.createResponse({
      input: userPrompt,
      instructions: params.systemPrompt?.trim() || undefined,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens
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

    const systemPrompt = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const inputMessages: OpenAIResponseInputMessage[] = messages
      .filter((message): message is OpenAIResponseInputMessage => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    if (inputMessages.length === 0) {
      throw new AppError("INVALID_REQUEST", "messages must include at least one user or assistant message.", 400);
    }

    return this.createResponse({
      input: inputMessages,
      instructions: systemPrompt || undefined,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens
    });
  }

  private getClient(): OpenAI {
    if (!env.openaiApiKey) {
      throw new AppError(
        "MISSING_API_KEY",
        "OPENAI_API_KEY is not configured. Please set it before calling LLM APIs.",
        503
      );
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: env.openaiApiKey,
        baseURL: env.openaiBaseUrl,
        timeout: env.llmTimeoutMs,
        maxRetries: 0
      });
    }

    return this.client;
  }

  private async createResponse(params: {
    input: string | OpenAIResponseInputMessage[];
    instructions?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<LLMResult> {
    try {
      const response = await this.getClient().responses.create(
        {
          model: env.openaiModel,
          input: params.input,
          instructions: params.instructions,
          temperature: this.normalizeTemperature(params.temperature),
          max_output_tokens: this.normalizeMaxOutputTokens(params.maxOutputTokens)
        },
        {
          timeout: env.llmTimeoutMs
        }
      );

      return {
        text: this.extractText(response),
        model: this.extractModel(response) ?? env.openaiModel,
        usage: this.extractUsage(response),
        raw: response
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        logger.warn("LLM request timed out.", this.toSafeErrorMeta(error));
        throw new AppError("LLM_TIMEOUT", "LLM request timed out.", 504, error);
      }

      logger.error("LLM request failed.", this.toSafeErrorMeta(error));
      throw new AppError(
        "LLM_REQUEST_FAILED",
        "LLM request failed. Please try again later.",
        502,
        error
      );
    }
  }

  private extractText(response: unknown): string {
    if (!isRecordLike(response)) {
      return "";
    }

    const outputText = response.output_text;
    if (typeof outputText === "string") {
      return outputText;
    }

    const output = response.output;
    if (!Array.isArray(output)) {
      return "";
    }

    const textParts: string[] = [];

    for (const item of output) {
      if (!isRecordLike(item) || !Array.isArray(item.content)) {
        continue;
      }

      for (const content of item.content) {
        if (typeof content === "string") {
          textParts.push(content);
          continue;
        }

        if (!isRecordLike(content)) {
          continue;
        }

        if (typeof content.text === "string") {
          textParts.push(content.text);
        }
      }
    }

    return textParts.join("\n").trim();
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
    const inputTokens = readNumber(usage.input_tokens) ?? readNumber(usage.inputTokens);
    const outputTokens = readNumber(usage.output_tokens) ?? readNumber(usage.outputTokens);
    const totalTokens =
      readNumber(usage.total_tokens) ??
      readNumber(usage.totalTokens) ??
      (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined);

    return {
      inputTokens,
      outputTokens,
      totalTokens
    };
  }

  private isTimeoutError(error: unknown): boolean {
    if (!isRecordLike(error)) {
      return false;
    }

    const name = typeof error.name === "string" ? error.name : "";
    const code = typeof error.code === "string" ? error.code : "";
    const message = typeof error.message === "string" ? error.message : "";

    return /timeout|timed out|abort|ETIMEDOUT/i.test(`${name} ${code} ${message}`);
  }

  private toSafeErrorMeta(error: unknown): Record<string, unknown> {
    if (!isRecordLike(error)) {
      return { errorType: typeof error };
    }

    return {
      name: error.name,
      code: error.code,
      status: error.status,
      type: error.type,
      message: error.message
    };
  }
}

function isRecordLike(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export const llmService = new LLMService();
