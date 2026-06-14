import { Router } from "express";
import {
  createConversation,
  getConversation,
  listConversations
} from "../controllers/conversations.controller";

const router = Router();

router.get("/", listConversations);
router.post("/", createConversation);
router.get("/:id", getConversation);

export default router;
