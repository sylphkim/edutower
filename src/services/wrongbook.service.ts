import { mockWrongbookItems } from "../mock/wrongbook";
import {
  BUILTIN_WRONGBOOK_CATEGORIES,
  BUILTIN_WRONGBOOK_SUBJECTS
} from "../mock/wrongbookTaxonomy";
import type {
  CreateWrongbookInput,
  CreateWrongbookTaxonomyInput,
  UpdateWrongbookInput,
  WrongbookItem,
  WrongbookListPayload,
  WrongbookTaxonomyEntry,
  DeleteWrongbookTaxonomyResult
} from "../types/wrongbook";
import { AppError } from "../utils/errors";

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

// 先用内存数组保存数据，以后可以把这里替换成数据库查询。
const wrongbookItems: WrongbookItem[] = mockWrongbookItems.map((item) => ({
  ...item,
  subject: normalizeSubjectId(item.subject),
  category: normalizeCategoryId(item.category)
}));
let nextWrongbookNumber = wrongbookItems.length + 1;

function createWrongbookId(): string {
  const id = `wrong-${String(nextWrongbookNumber).padStart(3, "0")}`;
  nextWrongbookNumber += 1;
  return id;
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

function findIndexById(id: string): number {
  const index = wrongbookItems.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new AppError("INVALID_REQUEST", "Wrongbook item not found.", 404);
  }

  return index;
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

  if (input.subject !== undefined && !findSubject(input.subject)) {
    throw new AppError("INVALID_REQUEST", "subject is not a valid taxonomy id.", 400);
  }

  if (input.category !== undefined && !findCategory(input.category)) {
    throw new AppError("INVALID_REQUEST", "category is not a valid taxonomy id.", 400);
  }
}

export const wrongbookService = {
  list(): WrongbookListPayload {
    return {
      items: wrongbookItems,
      subjects: allSubjects(),
      categories: allCategories()
    };
  },

  getById(id: string): WrongbookItem {
    return wrongbookItems[findIndexById(id)];
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

  removeSubject(id: string): DeleteWrongbookTaxonomyResult {
    const index = customSubjects.findIndex((entry) => entry.id === id);

    if (index === -1) {
      if (BUILTIN_WRONGBOOK_SUBJECTS.some((entry) => entry.id === id)) {
        throw new AppError("INVALID_REQUEST", "Built-in subjects cannot be deleted.", 400);
      }

      throw new AppError("INVALID_REQUEST", "Subject not found.", 404);
    }

    let reassignedItemCount = 0;
    wrongbookItems.forEach((item) => {
      if (item.subject === id) {
        item.subject = "uncategorized";
        reassignedItemCount += 1;
      }
    });

    const [removed] = customSubjects.splice(index, 1);
    return { removed, reassignedItemCount };
  },

  removeCategory(id: string): DeleteWrongbookTaxonomyResult {
    const index = customCategories.findIndex((entry) => entry.id === id);

    if (index === -1) {
      if (BUILTIN_WRONGBOOK_CATEGORIES.some((entry) => entry.id === id)) {
        throw new AppError("INVALID_REQUEST", "Built-in categories cannot be deleted.", 400);
      }

      throw new AppError("INVALID_REQUEST", "Category not found.", 404);
    }

    let reassignedItemCount = 0;
    wrongbookItems.forEach((item) => {
      if (item.category === id) {
        item.category = "uncategorized";
        reassignedItemCount += 1;
      }
    });

    const [removed] = customCategories.splice(index, 1);
    return { removed, reassignedItemCount };
  },

  create(input: CreateWrongbookInput): WrongbookItem {
    ensureValidCreateInput(input);

    const item: WrongbookItem = {
      id: createWrongbookId(),
      question: input.question,
      wrongAnswer: input.wrongAnswer.trim(),
      reviewCount: input.reviewCount ?? 0,
      lastReviewedAt: input.lastReviewedAt,
      subject: normalizeSubjectId(input.subject),
      category: normalizeCategoryId(input.category)
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
      lastReviewedAt: input.lastReviewedAt ?? currentItem.lastReviewedAt,
      subject: input.subject !== undefined ? input.subject : currentItem.subject,
      category: input.category !== undefined ? input.category : currentItem.category
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
