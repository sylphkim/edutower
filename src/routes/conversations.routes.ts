import { Router } from "express";
import {
  createConversation,
  getConversation,
  listConversations,
  summarizeConversation
} from "../controllers/conversations.controller";

const router = Router();

router.get("/", listConversations);
router.post("/", createConversation);
router.get("/:id", getConversation);
router.post("/:id/summarize", summarizeConversation);

export default router;
