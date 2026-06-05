import { Router } from "express";
import {
  createWrongbookCategory,
  createWrongbookItem,
  createWrongbookSubject,
  deleteWrongbookCategory,
  deleteWrongbookItem,
  deleteWrongbookSubject,
  getWrongbookItem,
  listWrongbookItems,
  updateWrongbookItem
} from "../controllers/wrongbook.controller";

const router = Router();

router.get("/", listWrongbookItems);
router.post("/subjects", createWrongbookSubject);
router.delete("/subjects/:id", deleteWrongbookSubject);
router.post("/categories", createWrongbookCategory);
router.delete("/categories/:id", deleteWrongbookCategory);
router.get("/:id", getWrongbookItem);
router.post("/", createWrongbookItem);
router.patch("/:id", updateWrongbookItem);
router.delete("/:id", deleteWrongbookItem);

export default router;
