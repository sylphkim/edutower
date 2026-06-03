import { Router } from "express";
import {
  createMaterial,
  deleteMaterial,
  getMaterial,
  listMaterials,
  updateMaterial
} from "../controllers/materials.controller";

const router = Router();

router.get("/", listMaterials);
router.get("/:id", getMaterial);
router.post("/", createMaterial);
router.patch("/:id", updateMaterial);
router.delete("/:id", deleteMaterial);

export default router;
