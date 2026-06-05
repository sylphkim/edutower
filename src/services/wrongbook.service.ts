import { mockWrongbookItems } from "../mock/wrongbook";
import type { CreateWrongbookInput, UpdateWrongbookInput, WrongbookItem } from "../types/wrongbook";
import { AppError } from "../utils/errors";

// 先用内存数组保存数据，以后可以把这里替换成数据库查询。
const wrongbookItems: WrongbookItem[] = mockWrongbookItems.map((item) => ({ ...item }));
let nextWrongbookNumber = wrongbookItems.length + 1;

function createWrongbookId(): string {
  const id = `wrong-${String(nextWrongbookNumber).padStart(3, "0")}`;
  nextWrongbookNumber += 1;
  return id;
}

// 统一处理找不到 id 的情况，避免调用方静默失败。
function findIndexById(id: string): number {
  const index = wrongbookItems.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new AppError("INVALID_REQUEST", "Wrongbook item not found.", 404);
  }

  return index;
}

function ensureValidCreateInput(input: CreateWrongbookInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!input.question || typeof input.question !== "object") {
    throw new AppError("INVALID_REQUEST", "question is required.", 400);
  }

  if (!input.wrongAnswer || typeof input.wrongAnswer !== "string" || !input.wrongAnswer.trim()) {
    throw new AppError("INVALID_REQUEST", "wrongAnswer is required.", 400);
  }

  if (
    input.reviewCount !== undefined &&
    (!Number.isInteger(input.reviewCount) || input.reviewCount < 0)
  ) {
    throw new AppError("INVALID_REQUEST", "reviewCount must be a non-negative integer.", 400);
  }
}

function ensureValidUpdateInput(input: UpdateWrongbookInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (
    input.wrongAnswer !== undefined &&
    (typeof input.wrongAnswer !== "string" || !input.wrongAnswer.trim())
  ) {
    throw new AppError("INVALID_REQUEST", "wrongAnswer must be a non-empty string.", 400);
  }

  if (
    input.reviewCount !== undefined &&
    (!Number.isInteger(input.reviewCount) || input.reviewCount < 0)
  ) {
    throw new AppError("INVALID_REQUEST", "reviewCount must be a non-negative integer.", 400);
  }
}

export const wrongbookService = {
  list(): { items: WrongbookItem[] } {
    return {
      items: wrongbookItems
    };
  },

  getById(id: string): WrongbookItem {
    return wrongbookItems[findIndexById(id)];
  },

  create(input: CreateWrongbookInput): WrongbookItem {
    ensureValidCreateInput(input);

    const item: WrongbookItem = {
      id: createWrongbookId(),
      question: input.question,
      wrongAnswer: input.wrongAnswer.trim(),
      reviewCount: input.reviewCount ?? 0,
      lastReviewedAt: input.lastReviewedAt
    };

    wrongbookItems.push(item);
    return item;
  },

  update(id: string, input: UpdateWrongbookInput): WrongbookItem {
    ensureValidUpdateInput(input);

    const index = findIndexById(id);
    const currentItem = wrongbookItems[index];
    const updatedItem: WrongbookItem = {
      ...currentItem,
      question: input.question ?? currentItem.question,
      wrongAnswer:
        input.wrongAnswer !== undefined ? input.wrongAnswer.trim() : currentItem.wrongAnswer,
      reviewCount: input.reviewCount ?? currentItem.reviewCount,
      lastReviewedAt: input.lastReviewedAt ?? currentItem.lastReviewedAt
    };

    wrongbookItems[index] = updatedItem;
    return updatedItem;
  },

  remove(id: string): WrongbookItem {
    const index = findIndexById(id);
    const [removedItem] = wrongbookItems.splice(index, 1);

    return removedItem;
  }
};
