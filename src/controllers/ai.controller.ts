import { NextFunction, Request, Response } from "express";
import { aiEngineService } from "../services/aiEngine.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = readMessage(req.body);
    const sessionId = readSessionId(req.body);
    const result = await aiEngineService.chat({ sessionId, message });

    sendSuccess(res, {
      reply: result.reply,
      text: result.reply,
      engine: "fastapi"
    });
  } catch (error) {
    next(error);
  }
}

export async function legacyChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = readMessage(req.body);
    const sessionId = readSessionId(req.body);
    const result = await aiEngineService.chat({ sessionId, message });

    res.json({
      reply: result.reply
    });
  } catch (error) {
    next(error);
  }
}

function readMessage(body: unknown): string {
  const message = isRecordLike(body) && typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    throw new AppError("INVALID_REQUEST", "message is required.", 400);
  }

  return message;
}

function readSessionId(body: unknown): string {
  const rawSessionId =
    isRecordLike(body) && typeof body.session_id === "string"
      ? body.session_id
      : isRecordLike(body) && typeof body.sessionId === "string"
        ? body.sessionId
        : "default";

  return rawSessionId.trim() || "default";
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
