import { Router } from "express";
import {
  createMaterial,
  deleteMaterial,
  getMaterial,
  listMaterials,
  uploadMaterial,
  updateMaterial
} from "../controllers/materials.controller";
import { materialUploadMiddleware } from "../middlewares/materialUpload.middleware";

const router = Router();

router.get("/", listMaterials);
router.post("/", createMaterial);
router.post("/upload", materialUploadMiddleware, uploadMaterial);
router.get("/:id", getMaterial);
router.patch("/:id", updateMaterial);
router.delete("/:id", deleteMaterial);

export default router;
