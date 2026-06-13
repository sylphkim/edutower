import { Router } from "express";
import { listConcepts } from "../controllers/concepts.controller";

const router = Router();

router.get("/", listConcepts);

export default router;
