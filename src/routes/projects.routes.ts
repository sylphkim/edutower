import { Router } from "express";
import {
  getCurrentProject,
  updateCurrentProject
} from "../controllers/projects.controller";

const router = Router();

router.get("/current", getCurrentProject);
router.patch("/current", updateCurrentProject);

export default router;
