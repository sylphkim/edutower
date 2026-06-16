import { Router } from "express";
import {
  getCurrentProject,
  getProjectById,
  updateCurrentProject,
  updateProjectById
} from "../controllers/projects.controller";

const router = Router();

router.get("/current", getCurrentProject);
router.patch("/current", updateCurrentProject);
router.get("/:projectId", getProjectById);
router.patch("/:projectId", updateProjectById);

export default router;
