import { Router } from "express";
import {
  getLlmSettingsStatus,
  saveLlmSettings,
  testLlmSettings
} from "../controllers/settings.controller";

const router = Router();

router.get("/llm/status", getLlmSettingsStatus);
router.post("/llm", saveLlmSettings);
router.post("/llm/test", testLlmSettings);

export default router;
