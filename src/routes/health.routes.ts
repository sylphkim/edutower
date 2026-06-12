import { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { env } from "../config/env";
import type { DatabaseStatus } from "../types/edutower";
import { sendSuccess } from "../utils/apiResponse";

const router = Router();

function toDbPath(url: string): string {
  return url.replace(/^file:/, "");
}

function checkDatabase(): DatabaseStatus {
  if (!env.databaseUrl) {
    return "not_configured";
  }

  try {
    const db = new DatabaseSync(toDbPath(env.databaseUrl));
    db.exec("SELECT 1");
    db.close();
    return "ok";
  } catch {
    return "error";
  }
}

router.get("/", (_req, res) => {
  const database = checkDatabase();
  const isHealthy = database !== "error";

  sendSuccess(res, {
    status: isHealthy ? "ok" : "degraded",
    database
  });
});

export default router;