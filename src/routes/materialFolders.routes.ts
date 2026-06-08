import { Router } from "express";
import {
  createMaterialFolder,
  deleteMaterialFolder,
  listMaterialFolders,
  updateMaterialFolder
} from "../controllers/materialFolders.controller";

const router = Router();

router.get("/", listMaterialFolders);
router.post("/", createMaterialFolder);
router.patch("/:id", updateMaterialFolder);
router.delete("/:id", deleteMaterialFolder);

export default router;
