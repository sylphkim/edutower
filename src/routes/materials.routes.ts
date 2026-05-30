import { Router } from "express";
import { listMaterialChunks, uploadMaterial } from "../controllers/materials.controller";

const router = Router();

router.post("/upload", uploadMaterial);
router.get("/chunks", listMaterialChunks);

export default router;
