import { NextFunction, Request, Response } from "express";
import { agentPanelService } from "../services/agentPanel.service";
import { sendSuccess } from "../utils/apiResponse";

// 从 query 或对应 x- 头取值（与 session_id 的读取方式一致）。
function readParam(req: Request, queryKey: string, headerKey: string): string | undefined {
  const queryValue = typeof req.query[queryKey] === "string" ? (req.query[queryKey] as string) : "";
  const headerRaw = req.headers[headerKey];
  const headerValue = typeof headerRaw === "string" ? headerRaw : "";
  const value = (queryValue || headerValue).trim();

  return value || undefined;
}

function readSessionId(req: Request): string {
  return readParam(req, "session_id", "x-session-id") ?? "default";
}

export async function getAgentPanel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = readSessionId(req);
    // 项目型面板：前端可带 conversation_id / project_id 让面板反映真实项目；
    // 不带则维持按 session 行为（自由答疑→空）。
    const conversationId = readParam(req, "conversation_id", "x-conversation-id");
    const projectId = readParam(req, "project_id", "x-project-id");
    const result = await agentPanelService.buildPanel({ sessionId, conversationId, projectId });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
