import type { QuizQuestion } from "./edutower";

export interface WrongbookTaxonomyEntry {
  id: string;
  label: string;
  hint?: string;
  builtIn?: boolean;
}

export interface WrongbookItem {
  id: string;
  question: QuizQuestion;
  wrongAnswer: string;
  reviewCount: number;
  lastReviewedAt?: string;
  /** 学科 / 主题 id */
  subject: string;
  /** 错因 id */
  category: string;
}

export interface CreateWrongbookInput {
  question: QuizQuestion;
  wrongAnswer: string;
  reviewCount?: number;
  lastReviewedAt?: string;
  subject?: string;
  category?: string;
}

export interface UpdateWrongbookInput {
  question?: QuizQuestion;
  wrongAnswer?: string;
  reviewCount?: number;
  lastReviewedAt?: string;
  subject?: string;
  category?: string;
}

export interface CreateWrongbookTaxonomyInput {
  label: string;
  hint?: string;
}

export interface WrongbookListPayload {
  items: WrongbookItem[];
  subjects: WrongbookTaxonomyEntry[];
  categories: WrongbookTaxonomyEntry[];
}

export interface DeleteWrongbookTaxonomyResult {
  removed: WrongbookTaxonomyEntry;
  reassignedItemCount: number;
}
