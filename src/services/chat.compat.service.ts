import { env } from "../config/env";
import { llmService } from "./llm.service";
import { forwardChatToPythonAgent } from "./python-bridge.service";

/**
 * Resolves a frontend-compatible chat reply.
 * When USE_PYTHON_AGENT=true, delegates to the Python FastAPI microservice.
 */
export async function resolveFrontendChatReply(
  sessionId: string,
  message: string
): Promise<string> {
  if (env.usePythonAgent) {
    return forwardChatToPythonAgent(sessionId, message);
  }

  return llmService.chatSingleTurn(sessionId, message);
}
