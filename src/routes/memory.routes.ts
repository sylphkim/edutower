import { Router } from "express";
import {
  createDailySummary,
  createMemoryItem,
  deleteMemoryItem,
  getMemoryItem,
  listMemoryItems,
  updateMemoryItem
} from "../controllers/memory.controller";

const router = Router();

router.get("/", listMemoryItems);
router.post("/daily-summary", createDailySummary);
router.get("/:id", getMemoryItem);
router.post("/", createMemoryItem);
router.patch("/:id", updateMemoryItem);
router.delete("/:id", deleteMemoryItem);

export default router;
