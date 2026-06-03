import { Router } from "express";
import {
  createSkill,
  deleteSkill,
  getSkill,
  getSkillTree,
  listSkills,
  updateSkill
} from "../controllers/skills.controller";

const router = Router();

router.get("/", listSkills);
router.get("/tree", getSkillTree);
router.get("/:id", getSkill);
router.post("/", createSkill);
router.patch("/:id", updateSkill);
router.delete("/:id", deleteSkill);

export default router;
