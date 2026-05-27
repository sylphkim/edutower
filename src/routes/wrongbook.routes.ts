import { Router } from "express";
import { listWrongbookItems } from "../controllers/wrongbook.controller";

const router = Router();

router.get("/", listWrongbookItems);

export default router;
