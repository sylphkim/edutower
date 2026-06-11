import { Router } from "express";
import {
  closeToday,
  decideSummarySuggestions,
  ensureToday,
  getToday,
  listSheets,
  regenerateToday,
  updateDailyTask
} from "../controllers/dailyTasks.controller";

const router = Router();

router.get("/:projectId/today", getToday);
router.post("/:projectId/today", ensureToday);
router.post("/:projectId/today/regenerate", regenerateToday);
router.post("/:projectId/today/close", closeToday);
router.get("/:projectId/sheets", listSheets);
router.patch("/:projectId/tasks/:taskId", updateDailyTask);
router.post("/:projectId/summaries/:summaryId/decisions", decideSummarySuggestions);

export default router;
