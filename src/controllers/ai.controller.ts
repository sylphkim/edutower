import { NextFunction, Request, Response } from "express";
import { aiEngineService } from "../services/aiEngine.service";
import { chatContextService } from "../services/chatContext.service";
import { chatPersistenceService } from "../services/chatPersistence.service";
import { memoryService } from "../services/memory.service";
import type { CreateMemoryInput } from "../types/memory";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

const MEMORY_UPDATES_RE = /---memory_updates\n([\s\S]*?)\n---/;

function parseAndSaveMemoryUpdates(reply: string): string {
  const match = reply.match(MEMORY_UPDATES_RE);

  if (!match) {
    return reply;
  }

  try {
    const updates: CreateMemoryInput[] = JSON.parse(match[1]);

    if (Array.isArray(updates)) {
      for (const item of updates) {
        Promise.resolve(
          (async () => {
            // 按 title 查重：已存在的跳过
            const existing = await memoryService.findByTitle(item.title);
            if (existing) {
              return;
            }
            await memoryService.create({
              type: item.type,
              title: item.title,
              content: item.content,
              importance: item.importance
            });
          })()
        ).catch(() => {});
      }
    }
  } catch {
    // 解析失败时静默忽略
  }

  return reply.replace(MEMORY_UPDATES_RE, "").trim();
}
export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = readMessage(req.body);
    const sessionId = readSessionId(req.body);
    const context = await chatContextService.buildContext({ sessionId });
    const result = await aiEngineService.chat({ sessionId, message, context });

    const cleanReply = parseAndSaveMemoryUpdates(result.reply);

    chatPersistenceService.saveChatExchange({
      sessionId,
      userMessage: message,
      aiReply: cleanReply,
      engine: "fastapi"
    }).catch(() => {});    
    
    sendSuccess(res, {
      answer: cleanReply,
      reply: cleanReply,
      text: cleanReply,
      session_id: sessionId,
      engine: "fastapi",
      debugContextSummary: {
        materialCount: context.materials.length,
        knowledgePointCount: context.knowledgePoints.length,
        weakPointCount: context.weakPoints.length,
        sessionHistoryCount: context.sessionHistory.length,
        memoryCount: context.memories.length    
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function legacyChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = readMessage(req.body);
    const sessionId = readSessionId(req.body);
    const context = await chatContextService.buildContext({ sessionId });
    const result = await aiEngineService.chat({ sessionId, message, context });

    const cleanReply = parseAndSaveMemoryUpdates(result.reply);

    res.json({
      reply: cleanReply
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
