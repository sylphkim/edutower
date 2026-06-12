import { NextFunction, Request, Response } from "express";
import { conversationsService } from "../services/conversations.service";
import { sendSuccess } from "../utils/apiResponse";

export async function createConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await conversationsService.create(req.body);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await conversationsService.getById(id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
