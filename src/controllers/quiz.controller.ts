import { Request, Response } from "express";
import { quizService } from "../services/quiz.service";
import { sendSuccess } from "../utils/apiResponse";

export function generateQuiz(_req: Request, res: Response): void {
  sendSuccess(res, quizService.generateQuiz());
}

export function submitQuiz(_req: Request, res: Response): void {
  sendSuccess(res, quizService.submitQuiz());
}
