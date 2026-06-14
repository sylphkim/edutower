import { NextFunction, Request, Response } from "express";
import { agentPanelService } from "../services/agentPanel.service";
import { sendSuccess } from "../utils/apiResponse";

function readSessionId(req: Request): string {
  const queryValue = typeof req.query.session_id === "string" ? req.query.session_id : "";
  const headerValue = typeof req.headers["x-session-id"] === "string" ? req.headers["x-session-id"] : "";
  const sessionId = (queryValue || headerValue).trim();

  return sessionId || "default";
}

function readConversationId(req: Request): string | undefined {
  const queryValue =
    typeof req.query.conversation_id === "string" ? req.query.conversation_id : "";
  const trimmed = queryValue.trim();

  return trimmed || undefined;
}

function readOptionalQuery(req: Request, key: string): string | undefined {
  const value = typeof req.query[key] === "string" ? req.query[key] : "";
  const trimmed = value.trim();

  return trimmed || undefined;
}

export async function getAgentPanel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = readSessionId(req);
    const conversationId = readConversationId(req);
    const result = await agentPanelService.buildPanel({
      sessionId,
      conversationId,
      topicHint: readOptionalQuery(req, "topic"),
      lastMessageHint: readOptionalQuery(req, "last_message")
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
