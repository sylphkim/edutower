import { Router } from "express";
import {
  createConversation,
  getConversation
} from "../controllers/conversations.controller";

const router = Router();

router.post("/", createConversation);
router.get("/:id", getConversation);

export default router;
