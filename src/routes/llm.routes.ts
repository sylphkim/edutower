import { Router } from "express";
import { chat, generate } from "../controllers/llm.controller";

const router = Router();

router.post("/chat", chat);
router.post("/generate", generate);

export default router;
