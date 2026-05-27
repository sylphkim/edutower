import { Router } from "express";
import { generatePlan } from "../controllers/plan.controller";

const router = Router();

router.post("/generate", generatePlan);

export default router;
