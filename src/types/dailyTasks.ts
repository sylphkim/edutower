export type DailyTaskSheetStatus =
  | "generating"
  | "active"
  | "awaiting_confirmation"
  | "completed"
  | "forced_closed"
  | "generation_failed";

export type DailyTaskSheetCloseReason = "all_tasks_done" | "user" | "midnight";

export type DailyTaskType =
  | "read_material"
  | "practice_quiz"
  | "review_wrongbook"
  | "master_skill";

export type DailyTaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export type DailyTaskSource =
  | "plan"
  | "carry_over"
  | "daily_summary"
  | "quiz"
  | "wrongbook"
  | "weak_point"
  | "user_requested";

export type DailyLearningState = "not_started" | "learning" | "mastered";

export type DailySummaryStatus = "draft" | "awaiting_confirmation" | "confirmed";

export type DailyConfirmationSource = "user" | "system" | "system_forced";

export type DailySuggestionType = "knowledge_status" | "weakness" | "review_suggestion";

export type DailySuggestionStatus = "pending" | "accepted" | "modified" | "rejected";

export type DailySuggestionDecisionSource = "user" | "system_forced";

export interface DailyTaskItem {
  id: string;
  title: string;
  type: DailyTaskType;
  status: DailyTaskStatus;
  order: number;
  knowledgeNodeId: string | null;
  materialId: string | null;
  planPhaseId: string | null;
  carriedFromTaskId: string | null;
  estimatedMinutes: number | null;
  sourceType: DailyTaskSource | null;
  selectionReason: string | null;
  generationBatch: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailySuggestionItem {
  id: string;
  type: DailySuggestionType;
  knowledgeNodeId: string | null;
  studyTaskId: string | null;
  content: string;
  proposedLearningState: DailyLearningState | null;
  proposedMastery: number | null;
  modifiedContent: string | null;
  status: DailySuggestionStatus;
  decisionSource: DailySuggestionDecisionSource | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailySummaryItem {
  id: string;
  dailyTaskSheetId: string | null;
  summaryDate: string;
  status: DailySummaryStatus;
  aiDraft: string;
  confirmedContent: string | null;
  weaknesses: string | null;
  confirmationSource: DailyConfirmationSource | null;
  confirmedAt: string | null;
  suggestions: DailySuggestionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyTaskSheetItem {
  id: string;
  projectId: string;
  planVersionId: string | null;
  currentPhaseId: string | null;
  localDate: string;
  timezone: string;
  availableMinutes: number;
  generationCount: number;
  status: DailyTaskSheetStatus;
  generatedAt: string | null;
  closesAt: string;
  endedAt: string | null;
  closeReason: DailyTaskSheetCloseReason | null;
  tasks: DailyTaskItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyConversationItem {
  id: string;
  type: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** One day of study for a project: tasks, that day's conversations and summary. */
export interface DailyStudyRecord {
  sheet: DailyTaskSheetItem | null;
  summary: DailySummaryItem | null;
  conversations: DailyConversationItem[];
}

export interface UpdateDailyTaskStatusInput {
  status: Exclude<DailyTaskStatus, "cancelled">;
}

export interface DailyTaskStatusResult {
  task: DailyTaskItem;
  sheet: DailyTaskSheetItem;
  summary: DailySummaryItem | null;
  autoClosed: boolean;
}

export interface DailySheetHistoryEntry {
  sheet: DailyTaskSheetItem;
  summary: DailySummaryItem | null;
}

export interface SuggestionDecisionInput {
  suggestionId: string;
  action: "accept" | "modify" | "reject";
  modifiedContent?: string;
  proposedLearningState?: DailyLearningState;
  proposedMastery?: number;
}

export interface DecideSuggestionsInput {
  decisions: SuggestionDecisionInput[];
  confirmedContent?: string;
}

export interface DecideSuggestionsResult {
  summary: DailySummaryItem;
  sheet: DailyTaskSheetItem;
}
