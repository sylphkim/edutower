import { Router } from "express";
import {
  createConversation,
  getConversation,
  summarizeConversation
} from "../controllers/conversations.controller";

const router = Router();

router.post("/", createConversation);
router.get("/:id", getConversation);
router.post("/:id/summarize", summarizeConversation);

export default router;
