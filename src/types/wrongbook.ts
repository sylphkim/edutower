export type Difficulty = "easy" | "medium" | "hard";
export type QuizQuestionType = "single_choice" | "short_answer";

export interface QuizOption {
  id: string;
  text: string;
}

// 错题里嵌的题目快照（早期 mock 结构，错题本沿用至今）。
export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  stem: string;
  options?: QuizOption[];
  answer: string;
  explanation: string;
  difficulty: Difficulty;
  knowledgePointId: string;
}

export type WrongbookStatus = "uncorrected" | "corrected";

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
  status?: WrongbookStatus;
  reviewCount: number;
  lastReviewedAt?: string;
  correctedAt?: string;
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
