import axios, { isAxiosError } from "axios";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

interface PythonChatResponse {
  reply: string;
}

/**
 * Optional bridge: forward chat requests to a Python FastAPI agent service.
 * Enable with USE_PYTHON_AGENT=true and PYTHON_AGENT_URL=http://127.0.0.1:8000
 */
export async function forwardChatToPythonAgent(
  sessionId: string,
  message: string
): Promise<string> {
  const baseUrl = env.pythonAgentUrl.replace(/\/$/, "");

  try {
    const response = await axios.post<PythonChatResponse>(
      `${baseUrl}/chat`,
      {
        session_id: sessionId,
        message,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: env.llmTimeoutMs,
      }
    );

    if (typeof response.data?.reply !== "string") {
      throw new AppError(
        502,
        "PYTHON_AGENT_INVALID",
        "Python agent returned an invalid response shape."
      );
    }

    return response.data.reply;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const payload = error.response?.data as
        | { detail?: unknown; message?: string }
        | undefined;
      const detail = payload?.detail ?? payload?.message ?? error.message;

      throw new AppError(
        status,
        "PYTHON_AGENT_ERROR",
        typeof detail === "string" ? detail : JSON.stringify(detail)
      );
    }

    throw error;
  }
}
