import type { QuizQuestion } from "./edutower";

export interface WrongbookItem {
  id: string;
  question: QuizQuestion;
  wrongAnswer: string;
  reviewCount: number;
  lastReviewedAt?: string;
}

// 创建时不传 id，由 service 统一生成。
export interface CreateWrongbookInput {
  question: QuizQuestion;
  wrongAnswer: string;
  reviewCount?: number;
  lastReviewedAt?: string;
}

// PATCH 只需要传要修改的字段。
export interface UpdateWrongbookInput {
  question?: QuizQuestion;
  wrongAnswer?: string;
  reviewCount?: number;
  lastReviewedAt?: string;
}
