import { Router } from "express";
import { frontendChat } from "../controllers/llm.controller";

const router = Router();

/** Frontend shim: POST /chat -> { reply: string } */
router.post("/", frontendChat);

export default router;
