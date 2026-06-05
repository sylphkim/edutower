export type MemoryType = "weakness" | "daily_summary" | "progress" | "preference" | "note";
export type MemoryImportance = "low" | "medium" | "high";

export interface MemoryItem {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  relatedMaterialIds: string[];
  relatedSkillIds: string[];
  relatedQuizIds: string[];
  relatedWrongbookIds: string[];
  importance: MemoryImportance;
  createdAt: string;
  updatedAt: string;
}

// 创建时不传 id 和时间，由 service 统一补齐。
export interface CreateMemoryInput {
  type: MemoryType;
  title: string;
  content: string;
  relatedMaterialIds?: string[];
  relatedSkillIds?: string[];
  relatedQuizIds?: string[];
  relatedWrongbookIds?: string[];
  importance?: MemoryImportance;
}

// PATCH 只传需要修改的字段。
export interface UpdateMemoryInput {
  type?: MemoryType;
  title?: string;
  content?: string;
  relatedMaterialIds?: string[];
  relatedSkillIds?: string[];
  relatedQuizIds?: string[];
  relatedWrongbookIds?: string[];
  importance?: MemoryImportance;
}

export interface DailySummaryInput {
  planId?: string;
  learnedSkillIds?: string[];
  completedTaskIds?: string[];
  wrongbookIds?: string[];
  summary: string;
  weaknesses?: string[];
  nextSuggestions?: string[];
}
