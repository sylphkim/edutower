import { Router } from "express";
import { getMemoryProfile, updateMemoryProfile } from "../controllers/memory.controller";

const router = Router();

router.get("/profile", getMemoryProfile);
router.post("/update", updateMemoryProfile);

export default router;
