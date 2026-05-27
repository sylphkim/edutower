import { Router } from "express";
import { generateQuiz, submitQuiz } from "../controllers/quiz.controller";

const router = Router();

router.post("/generate", generateQuiz);
router.post("/submit", submitQuiz);

export default router;
