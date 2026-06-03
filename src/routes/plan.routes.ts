import { Router } from "express";
import {
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  updatePlan
} from "../controllers/plan.controller";

const router = Router();

router.get("/", listPlans);
router.get("/:id", getPlan);
router.post("/", createPlan);
router.patch("/:id", updatePlan);
router.delete("/:id", deletePlan);

export default router;
