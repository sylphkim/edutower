import { Router } from "express";
import {
  createWrongbookItem,
  deleteWrongbookItem,
  getWrongbookItem,
  listWrongbookItems,
  updateWrongbookItem
} from "../controllers/wrongbook.controller";

const router = Router();

router.get("/", listWrongbookItems);
router.get("/:id", getWrongbookItem);
router.post("/", createWrongbookItem);
router.patch("/:id", updateWrongbookItem);
router.delete("/:id", deleteWrongbookItem);

export default router;
