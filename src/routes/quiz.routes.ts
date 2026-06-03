import { Router } from "express";
import {
  createQuiz,
  deleteQuiz,
  getQuiz,
  listQuizzes,
  submitQuiz
} from "../controllers/quiz.controller";

const router = Router();

router.get("/", listQuizzes);
router.get("/:id", getQuiz);
router.post("/", createQuiz);
router.post("/:id/submit", submitQuiz);
router.delete("/:id", deleteQuiz);

export default router;
