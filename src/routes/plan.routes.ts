import { Router } from "express";
import {
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  updatePlan
} from "../controllers/plan.controller";
import {
  confirmPlanVersion,
  createPlanVersion,
  getCurrentPlanVersion,
  getPlanVersion,
  listPlanVersions,
  revisePlanVersion,
  updatePlanVersion
} from "../controllers/planVersions.controller";
import { applyPlanProposal, generatePlanProposal } from "../controllers/planProposals.controller";

const router = Router();

router.post("/:projectId/proposals/generate", generatePlanProposal);
router.post("/:projectId/proposals/apply", applyPlanProposal);

router.get("/:projectId/versions", listPlanVersions);
router.get("/:projectId/versions/current", getCurrentPlanVersion);
router.get("/:projectId/versions/:versionId", getPlanVersion);
router.post("/:projectId/versions", createPlanVersion);
router.patch("/:projectId/versions/:versionId", updatePlanVersion);
router.post("/:projectId/versions/:versionId/confirm", confirmPlanVersion);
router.post("/:projectId/versions/:versionId/revise", revisePlanVersion);

router.get("/", listPlans);
router.get("/:id", getPlan);
router.post("/", createPlan);
router.patch("/:id", updatePlan);
router.delete("/:id", deletePlan);

export default router;
