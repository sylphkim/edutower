import { Request, Response } from "express";
import { wrongbookService } from "../services/wrongbook.service";
import { sendError, sendSuccess } from "../utils/apiResponse";

export function listWrongbookItems(_req: Request, res: Response): void {
  sendSuccess(res, wrongbookService.listItems());
}

export function getWrongbookItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = wrongbookService.getItem(id);

  if (!result) {
    sendError(res, 404, "INVALID_REQUEST", "Wrongbook item not found.");
    return;
  }

  sendSuccess(res, result);
}

export function createWrongbookItem(req: Request, res: Response): void {
  const result = wrongbookService.createItem(req.body);

  sendSuccess(res, result, 201);
}

export function updateWrongbookItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = wrongbookService.updateItem(id, req.body);

  if (!result) {
    sendError(res, 404, "INVALID_REQUEST", "Wrongbook item not found.");
    return;
  }

  sendSuccess(res, result);
}

export function deleteWrongbookItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = wrongbookService.deleteItem(id);

  if (!result) {
    sendError(res, 404, "INVALID_REQUEST", "Wrongbook item not found.");
    return;
  }

  sendSuccess(res, result);
}
