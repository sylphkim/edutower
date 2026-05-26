import { NextFunction, Request, Response } from "express";
import { llmService } from "../services/llm.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!message) {
      throw new AppError("INVALID_REQUEST", "message is required.", 400);
    }

    const result = await llmService.chat({
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    });

    sendSuccess(res, {
      text: result.text,
      model: result.model,
      provider: result.provider,
      usage: result.usage
    });
  } catch (error) {
    next(error);
  }
}

export async function generate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userPrompt = typeof req.body?.userPrompt === "string" ? req.body.userPrompt.trim() : "";

    if (!userPrompt) {
      throw new AppError("INVALID_REQUEST", "userPrompt is required.", 400);
    }

    const systemPrompt =
      typeof req.body?.systemPrompt === "string" ? req.body.systemPrompt.trim() : undefined;
    const temperature = readOptionalNumber(req.body, "temperature");
    const maxOutputTokens = readOptionalNumber(req.body, "maxOutputTokens");

    const result = await llmService.generateText({
      systemPrompt,
      userPrompt,
      temperature,
      maxOutputTokens
    });

    sendSuccess(res, {
      text: result.text,
      model: result.model,
      provider: result.provider,
      usage: result.usage
    });
  } catch (error) {
    next(error);
  }
}

function readOptionalNumber(body: unknown, key: string): number | undefined {
  if (!isRecordLike(body) || body[key] === undefined) {
    return undefined;
  }

  const value = body[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError("INVALID_REQUEST", `${key} must be a valid number.`, 400);
  }

  return value;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
