import { Request, Response } from "express";
import { quizService } from "../services/quiz.service";
import { sendSuccess } from "../utils/apiResponse";

export function listQuizzes(_req: Request, res: Response): void {
  sendSuccess(res, quizService.list());
}

export function getQuiz(req: Request, res: Response): void {
  const { id } = req.params;
  const result = quizService.getById(id);

  sendSuccess(res, result);
}

export function createQuiz(req: Request, res: Response): void {
  const result = quizService.create(req.body);

  sendSuccess(res, result, 201);
}

export function submitQuiz(req: Request, res: Response): void {
  const { id } = req.params;
  const result = quizService.submit(id, req.body);

  sendSuccess(res, result);
}

export function deleteQuiz(req: Request, res: Response): void {
  const { id } = req.params;
  const result = quizService.remove(id);

  sendSuccess(res, result);
}
