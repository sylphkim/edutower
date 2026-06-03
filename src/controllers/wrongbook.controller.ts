import { Request, Response } from "express";
import { wrongbookService } from "../services/wrongbook.service";
import { sendSuccess } from "../utils/apiResponse";

export function listWrongbookItems(_req: Request, res: Response): void {
  sendSuccess(res, wrongbookService.list());
}

export function getWrongbookItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = wrongbookService.getById(id);

  sendSuccess(res, result);
}

export function createWrongbookItem(req: Request, res: Response): void {
  const result = wrongbookService.create(req.body);

  sendSuccess(res, result, 201);
}

export function updateWrongbookItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = wrongbookService.update(id, req.body);

  sendSuccess(res, result);
}

export function deleteWrongbookItem(req: Request, res: Response): void {
  const { id } = req.params;
  const result = wrongbookService.remove(id);

  sendSuccess(res, result);
}
