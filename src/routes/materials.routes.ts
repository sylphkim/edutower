import { Router } from "express";
import {
  createMaterial,
  deleteMaterial,
  downloadMaterial,
  getMaterial,
  listMaterialChunks,
  listMaterials,
  reparseMaterial,
  uploadMaterial,
  updateMaterial
} from "../controllers/materials.controller";
import { materialUploadMiddleware } from "../middlewares/materialUpload.middleware";

const router = Router();

router.get("/", listMaterials);
router.get("/chunks", listMaterialChunks);
router.post("/", createMaterial);
router.post("/upload", materialUploadMiddleware, uploadMaterial);
router.get("/:id/download", downloadMaterial);
router.get("/:id", getMaterial);
router.patch("/:id", updateMaterial);
router.delete("/:id", deleteMaterial);
router.post("/:id/reparse", reparseMaterial);

export default router;
