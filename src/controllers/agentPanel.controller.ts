import { NextFunction, Request, Response } from "express";
import { agentPanelService } from "../services/agentPanel.service";
import { sendSuccess } from "../utils/apiResponse";

function readSessionId(req: Request): string {
  const queryValue = typeof req.query.session_id === "string" ? req.query.session_id : "";
  const headerValue = typeof req.headers["x-session-id"] === "string" ? req.headers["x-session-id"] : "";
  const sessionId = (queryValue || headerValue).trim();

  return sessionId || "default";
}

export async function getAgentPanel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = readSessionId(req);
    const result = await agentPanelService.buildPanel({ sessionId });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
