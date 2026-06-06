import { wrongbookRepository } from "../repositories/wrongbook.repository";
import type {
  QuizQuestionType,
  WrongbookItem as PrismaWrongbookItem,
  WrongbookStatus as PrismaWrongbookStatus
} from "../generated/prisma/client";
import {
  BUILTIN_WRONGBOOK_CATEGORIES,
  BUILTIN_WRONGBOOK_SUBJECTS
} from "../mock/wrongbookTaxonomy";
import type { QuizQuestion } from "../types/edutower";
import type {
  CreateWrongbookInput,
  CreateWrongbookTaxonomyInput,
  DeleteWrongbookTaxonomyResult,
  UpdateWrongbookInput,
  WrongbookItem,
  WrongbookListPayload,
  WrongbookStatus,
  WrongbookTaxonomyEntry
} from "../types/wrongbook";
import { AppError } from "../utils/errors";
import { getDemoUserId } from "./demoUser.service";

type RuntimeQuestion = Partial<QuizQuestion> & {
  prompt?: string;
  answer?: string;
  explanation?: string;
};

interface QuestionSnapshot {
  questionType: QuizQuestionType;
  questionPrompt: string;
  correctAnswer: string;
  explanation?: string;
}

const customSubjects: WrongbookTaxonomyEntry[] = [];
const customCategories: WrongbookTaxonomyEntry[] = [];
let nextCustomSubjectNumber = 1;
let nextCustomCategoryNumber = 1;

function allSubjects(): WrongbookTaxonomyEntry[] {
  return [...BUILTIN_WRONGBOOK_SUBJECTS, ...customSubjects];
}

function allCategories(): WrongbookTaxonomyEntry[] {
  return [...BUILTIN_WRONGBOOK_CATEGORIES, ...customCategories];
}

function findSubject(id: string): WrongbookTaxonomyEntry | undefined {
  return allSubjects().find((entry) => entry.id === id);
}

function findCategory(id: string): WrongbookTaxonomyEntry | undefined {
  return allCategories().find((entry) => entry.id === id);
}

function normalizeSubjectId(subject: unknown): string {
  if (typeof subject === "string" && findSubject(subject.trim())) {
    return subject.trim();
  }

  return "uncategorized";
}

function normalizeCategoryId(category: unknown): string {
  if (typeof category === "string" && findCategory(category.trim())) {
    return category.trim();
  }

  return "uncategorized";
}

function createCustomSubjectId(): string {
  const id = `subject-custom-${String(nextCustomSubjectNumber).padStart(3, "0")}`;
  nextCustomSubjectNumber += 1;
  return id;
}

function createCustomCategoryId(): string {
  const id = `category-custom-${String(nextCustomCategoryNumber).padStart(3, "0")}`;
  nextCustomCategoryNumber += 1;
  return id;
}

function readTaxonomyLabel(label: unknown): string {
  if (typeof label !== "string" || !label.trim()) {
    throw new AppError("INVALID_REQUEST", "label is required and must be a non-empty string.", 400);
  }

  return label.trim();
}

function ensureUniqueSubjectLabel(label: string): void {
  const normalized = label.toLowerCase();
  const exists = allSubjects().some((entry) => entry.label.toLowerCase() === normalized);

  if (exists) {
    throw new AppError("INVALID_REQUEST", "A subject with this label already exists.", 400);
  }
}

function ensureUniqueCategoryLabel(label: string): void {
  const normalized = label.toLowerCase();
  const exists = allCategories().some((entry) => entry.label.toLowerCase() === normalized);

  if (exists) {
    throw new AppError("INVALID_REQUEST", "A category with this label already exists.", 400);
  }
}

function readQuestionSnapshot(question: unknown): QuestionSnapshot {
  if (!question || typeof question !== "object") {
    throw new AppError("INVALID_REQUEST", "question is required.", 400);
  }

  const runtimeQuestion = question as RuntimeQuestion;
  const questionType = runtimeQuestion.type;

  if (questionType !== "single_choice" && questionType !== "short_answer") {
    throw new AppError(
      "INVALID_REQUEST",
      "question type must be one of: single_choice, short_answer.",
      400
    );
  }

  const questionPrompt = (
    typeof runtimeQuestion.stem === "string" ? runtimeQuestion.stem : runtimeQuestion.prompt
  )?.trim();

  if (!questionPrompt) {
    throw new AppError("INVALID_REQUEST", "question prompt is required.", 400);
  }

  if (typeof runtimeQuestion.answer !== "string" || !runtimeQuestion.answer.trim()) {
    throw new AppError("INVALID_REQUEST", "question answer is required.", 400);
  }

  return {
    questionType,
    questionPrompt,
    correctAnswer: runtimeQuestion.answer.trim(),
    explanation:
      typeof runtimeQuestion.explanation === "string" && runtimeQuestion.explanation.trim()
        ? runtimeQuestion.explanation.trim()
        : undefined
  };
}

function readWrongAnswer(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError("INVALID_REQUEST", "wrongAnswer is required.", 400);
  }

  return value.trim();
}

function readOptionalDate(value: unknown, fieldName: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError("INVALID_REQUEST", `${fieldName} must be an ISO date string.`, 400);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("INVALID_REQUEST", `${fieldName} must be a valid ISO date string.`, 400);
  }

  return date;
}

function ensureValidCreateInput(input: CreateWrongbookInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  readQuestionSnapshot(input.question);
  readWrongAnswer(input.wrongAnswer);

  if (
    input.reviewCount !== undefined &&
    (!Number.isInteger(input.reviewCount) || input.reviewCount < 0)
  ) {
    throw new AppError("INVALID_REQUEST", "reviewCount must be a non-negative integer.", 400);
  }

  readOptionalDate(input.lastReviewedAt, "lastReviewedAt");

  if (input.subject !== undefined && !findSubject(input.subject)) {
    throw new AppError("INVALID_REQUEST", "subject is not a valid taxonomy id.", 400);
  }

  if (input.category !== undefined && !findCategory(input.category)) {
    throw new AppError("INVALID_REQUEST", "category is not a valid taxonomy id.", 400);
  }
}

function ensureValidUpdateInput(input: UpdateWrongbookInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (input.question !== undefined) {
    readQuestionSnapshot(input.question);
  }

  if (input.wrongAnswer !== undefined) {
    readWrongAnswer(input.wrongAnswer);
  }

  if (
    input.reviewCount !== undefined &&
    (!Number.isInteger(input.reviewCount) || input.reviewCount < 0)
  ) {
    throw new AppError("INVALID_REQUEST", "reviewCount must be a non-negative integer.", 400);
  }

  readOptionalDate(input.lastReviewedAt, "lastReviewedAt");

  if (input.subject !== undefined && !findSubject(input.subject)) {
    throw new AppError("INVALID_REQUEST", "subject is not a valid taxonomy id.", 400);
  }

  if (input.category !== undefined && !findCategory(input.category)) {
    throw new AppError("INVALID_REQUEST", "category is not a valid taxonomy id.", 400);
  }
}

function ensureWrongbookExists(item: PrismaWrongbookItem | null): PrismaWrongbookItem {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Wrongbook item not found.", 404);
  }

  return item;
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

function toCorrectionState(
  userAnswer: string,
  correctAnswer: string
): { status: PrismaWrongbookStatus; correctedAt: Date | null } {
  if (normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)) {
    return {
      status: "corrected",
      correctedAt: new Date()
    };
  }

  return {
    status: "uncorrected",
    correctedAt: null
  };
}

function toApiStatus(status: PrismaWrongbookStatus): WrongbookStatus {
  return status as WrongbookStatus;
}

function toApiWrongbookItem(item: PrismaWrongbookItem): WrongbookItem {
  return {
    id: item.id,
    question: {
      id: item.quizQuestionId ?? item.id,
      type: item.questionType,
      stem: item.questionPrompt,
      answer: item.correctAnswer,
      explanation: item.explanation ?? "",
      difficulty: "medium",
      knowledgePointId: item.knowledgeNodeId ?? ""
    },
    wrongAnswer: item.wrongAnswer,
    status: toApiStatus(item.status),
    reviewCount: item.reviewCount,
    lastReviewedAt: item.lastReviewedAt?.toISOString(),
    correctedAt: item.correctedAt?.toISOString(),
    subject: normalizeSubjectId(item.subject),
    category: normalizeCategoryId(item.category)
  };
}

export const wrongbookService = {
  async list(): Promise<WrongbookListPayload> {
    const userId = await getDemoUserId();
    const items = await wrongbookRepository.listActiveByUser(userId);

    return {
      items: items.map(toApiWrongbookItem),
      subjects: allSubjects(),
      categories: allCategories()
    };
  },

  async getById(id: string): Promise<WrongbookItem> {
    const userId = await getDemoUserId();
    const item = ensureWrongbookExists(await wrongbookRepository.findActiveByIdForUser(id, userId));

    return toApiWrongbookItem(item);
  },

  createSubject(input: CreateWrongbookTaxonomyInput): WrongbookTaxonomyEntry {
    const label = readTaxonomyLabel(input.label);
    ensureUniqueSubjectLabel(label);

    const entry: WrongbookTaxonomyEntry = {
      id: createCustomSubjectId(),
      label,
      hint: typeof input.hint === "string" && input.hint.trim() ? input.hint.trim() : undefined,
      builtIn: false
    };

    customSubjects.push(entry);
    return entry;
  },

  createCategory(input: CreateWrongbookTaxonomyInput): WrongbookTaxonomyEntry {
    const label = readTaxonomyLabel(input.label);
    ensureUniqueCategoryLabel(label);

    const entry: WrongbookTaxonomyEntry = {
      id: createCustomCategoryId(),
      label,
      builtIn: false
    };

    customCategories.push(entry);
    return entry;
  },

  async removeSubject(id: string): Promise<DeleteWrongbookTaxonomyResult> {
    const index = customSubjects.findIndex((entry) => entry.id === id);

    if (index === -1) {
      if (BUILTIN_WRONGBOOK_SUBJECTS.some((entry) => entry.id === id)) {
        throw new AppError("INVALID_REQUEST", "Built-in subjects cannot be deleted.", 400);
      }

      throw new AppError("INVALID_REQUEST", "Subject not found.", 404);
    }

    const userId = await getDemoUserId();
    const reassignedItemCount = await wrongbookRepository.reassignSubjectForUser(
      userId,
      id,
      "uncategorized"
    );
    const [removed] = customSubjects.splice(index, 1);

    return { removed, reassignedItemCount };
  },

  async removeCategory(id: string): Promise<DeleteWrongbookTaxonomyResult> {
    const index = customCategories.findIndex((entry) => entry.id === id);

    if (index === -1) {
      if (BUILTIN_WRONGBOOK_CATEGORIES.some((entry) => entry.id === id)) {
        throw new AppError("INVALID_REQUEST", "Built-in categories cannot be deleted.", 400);
      }

      throw new AppError("INVALID_REQUEST", "Category not found.", 404);
    }

    const userId = await getDemoUserId();
    const reassignedItemCount = await wrongbookRepository.reassignCategoryForUser(
      userId,
      id,
      "uncategorized"
    );
    const [removed] = customCategories.splice(index, 1);

    return { removed, reassignedItemCount };
  },

  async create(input: CreateWrongbookInput): Promise<WrongbookItem> {
    ensureValidCreateInput(input);

    const userId = await getDemoUserId();
    const snapshot = readQuestionSnapshot(input.question);
    const wrongAnswer = readWrongAnswer(input.wrongAnswer);
    const correctionState = toCorrectionState(wrongAnswer, snapshot.correctAnswer);
    const item = await wrongbookRepository.create({
      userId,
      ...snapshot,
      wrongAnswer,
      subject: normalizeSubjectId(input.subject),
      category: normalizeCategoryId(input.category),
      reviewCount: input.reviewCount ?? 0,
      lastReviewedAt: readOptionalDate(input.lastReviewedAt, "lastReviewedAt"),
      ...correctionState
    });

    return toApiWrongbookItem(item);
  },

  async update(id: string, input: UpdateWrongbookInput): Promise<WrongbookItem> {
    ensureValidUpdateInput(input);

    const userId = await getDemoUserId();
    const currentItem = ensureWrongbookExists(
      await wrongbookRepository.findActiveByIdForUser(id, userId)
    );
    const snapshot = input.question ? readQuestionSnapshot(input.question) : undefined;
    const wrongAnswer =
      input.wrongAnswer !== undefined ? readWrongAnswer(input.wrongAnswer) : undefined;
    const correctAnswer = snapshot?.correctAnswer ?? currentItem.correctAnswer;
    const correctionState =
      wrongAnswer !== undefined ? toCorrectionState(wrongAnswer, correctAnswer) : {};
    const updatedItem = await wrongbookRepository.updateByIdForUser(id, userId, {
      questionType: snapshot?.questionType,
      questionPrompt: snapshot?.questionPrompt,
      correctAnswer: snapshot?.correctAnswer,
      explanation: snapshot ? snapshot.explanation ?? null : undefined,
      wrongAnswer,
      subject: input.subject !== undefined ? input.subject : undefined,
      category: input.category !== undefined ? input.category : undefined,
      reviewCount: input.reviewCount,
      lastReviewedAt: readOptionalDate(input.lastReviewedAt, "lastReviewedAt"),
      ...correctionState
    });

    return toApiWrongbookItem(updatedItem);
  },

  async remove(id: string): Promise<WrongbookItem> {
    const userId = await getDemoUserId();
    const currentItem = ensureWrongbookExists(
      await wrongbookRepository.findActiveByIdForUser(id, userId)
    );
    const removedItem = await wrongbookRepository.softDeleteByIdForUser(currentItem.id, userId);

    return toApiWrongbookItem(removedItem);
  }
};
