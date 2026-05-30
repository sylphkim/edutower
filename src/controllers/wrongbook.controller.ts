import { Request, Response } from "express";
import { wrongbookService } from "../services/wrongbook.service";
import { sendSuccess } from "../utils/apiResponse";

export function listWrongbookItems(_req: Request, res: Response): void {
  sendSuccess(res, wrongbookService.listItems());
}
