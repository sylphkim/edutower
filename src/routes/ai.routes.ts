import { Router } from "express";
import { chat } from "../controllers/llm.controller";

const router = Router();

router.post("/chat", chat);

export default router;
