import { NextFunction, Request, Response } from "express";
import { quizService } from "../services/quiz.service";
import { sendSuccess } from "../utils/apiResponse";

export async function listQuizzes(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(res, await quizService.list());
  } catch (error) {
    next(error);
  }
}

export async function getQuiz(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await quizService.getById(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createQuiz(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await quizService.create(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function submitQuiz(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await quizService.submit(id, req.body);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteQuiz(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await quizService.remove(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
