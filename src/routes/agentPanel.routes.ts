import { Router } from "express";
import { getAgentPanel } from "../controllers/agentPanel.controller";

const router = Router();

router.get("/panel", getAgentPanel);

export default router;
