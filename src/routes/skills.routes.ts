import { Router } from "express";
import { getSkillTree } from "../controllers/skills.controller";

const router = Router();

router.get("/tree", getSkillTree);

export default router;
