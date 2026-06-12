import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import path from "node:path";
import { legacyChat } from "./controllers/ai.controller";
import { sendError } from "./utils/apiResponse";
import { isAppError } from "./utils/errors";
import { logger } from "./utils/logger";
import aiRoutes from "./routes/ai.routes";
import agentPanelRoutes from "./routes/agentPanel.routes";
import conversationsRoutes from "./routes/conversations.routes";
import dailyTasksRoutes from "./routes/dailyTasks.routes";
import healthRoutes from "./routes/health.routes";
import llmRoutes from "./routes/llm.routes";
import materialFoldersRoutes from "./routes/materialFolders.routes";
import materialsRoutes from "./routes/materials.routes";
import memoryRoutes from "./routes/memory.routes";
import planRoutes from "./routes/plan.routes";
import quizRoutes from "./routes/quiz.routes";
import skillsRoutes from "./routes/skills.routes";
import wrongbookRoutes from "./routes/wrongbook.routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/static", express.static(path.join(process.cwd(), "static")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "static", "index.html"));
});

app.post("/chat", legacyChat);

app.use("/api/health", healthRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/agent", agentPanelRoutes);
app.use("/api/llm", llmRoutes);
app.use("/api/material-folders", materialFoldersRoutes);
app.use("/api/materials", materialsRoutes);
app.use("/api/plan", planRoutes);
app.use("/api/daily", dailyTasksRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/wrongbook", wrongbookRoutes);
app.use("/api/memory", memoryRoutes);

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
