import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { sendError } from "./utils/apiResponse";
import { isAppError } from "./utils/errors";
import { logger } from "./utils/logger";
import healthRoutes from "./routes/health.routes";
import llmRoutes from "./routes/llm.routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRoutes);
app.use("/api/llm", llmRoutes);

app.use((_req, res) => {
  sendError(res, 404, "INVALID_REQUEST", "Route not found.");
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isAppError(error)) {
    sendError(res, error.statusCode, error.code, error.message);
    return;
  }

  logger.error("Unhandled application error.", error);
  sendError(res, 500, "INTERNAL_ERROR", "Internal server error.");
});

export default app;
