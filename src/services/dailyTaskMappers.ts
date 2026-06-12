import type { StudyTask } from "../generated/prisma/client";
import type {
  DailySummaryWithSuggestions,
  DailyTaskSheetWithRelations,
  DayEvidenceConversation
} from "../repositories/dailyTaskSheets.repository";
import type {
  DailyConversationItem,
  DailySuggestionItem,
  DailySummaryItem,
  DailyTaskItem,
  DailyTaskSheetItem
} from "../types/dailyTasks";

export function toDailyTaskItem(task: StudyTask): DailyTaskItem {
  return {
    id: task.id,
    title: task.title,
    type: task.type as DailyTaskItem["type"],
    status: task.status as DailyTaskItem["status"],
    order: task.order,
    knowledgeNodeId: task.knowledgeNodeId,
    materialId: task.materialId,
    planPhaseId: task.planPhaseId,
    carriedFromTaskId: task.carriedFromTaskId,
    estimatedMinutes: task.estimatedMinutes,
    sourceType: task.sourceType as DailyTaskItem["sourceType"],
    selectionReason: task.selectionReason,
    generationBatch: task.generationBatch,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export function toDailySummaryItem(
  summary: DailySummaryWithSuggestions
): DailySummaryItem {
  return {
    id: summary.id,
    dailyTaskSheetId: summary.dailyTaskSheetId,
    summaryDate: summary.summaryDate.toISOString(),
    status: summary.status as DailySummaryItem["status"],
    aiDraft: summary.aiDraft,
    confirmedContent: summary.confirmedContent,
    weaknesses: summary.weaknesses,
    confirmationSource:
      summary.confirmationSource as DailySummaryItem["confirmationSource"],
    confirmedAt: summary.confirmedAt?.toISOString() ?? null,
    suggestions: summary.suggestions.map(
      (suggestion): DailySuggestionItem => ({
        id: suggestion.id,
        type: suggestion.type as DailySuggestionItem["type"],
        knowledgeNodeId: suggestion.knowledgeNodeId,
        studyTaskId: suggestion.studyTaskId,
        content: suggestion.content,
        proposedLearningState:
          suggestion.proposedLearningState as DailySuggestionItem["proposedLearningState"],
        proposedMastery: suggestion.proposedMastery,
        modifiedContent: suggestion.modifiedContent,
        status: suggestion.status as DailySuggestionItem["status"],
        decisionSource:
          suggestion.decisionSource as DailySuggestionItem["decisionSource"],
        decidedAt: suggestion.decidedAt?.toISOString() ?? null,
        createdAt: suggestion.createdAt.toISOString(),
        updatedAt: suggestion.updatedAt.toISOString()
      })
    ),
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString()
  };
}

export function toDailySheetItem(
  sheet: DailyTaskSheetWithRelations
): DailyTaskSheetItem {
  return {
    id: sheet.id,
    projectId: sheet.projectId,
    planVersionId: sheet.planVersionId,
    currentPhaseId: sheet.currentPhaseId,
    localDate: sheet.localDate,
    timezone: sheet.timezone,
    availableMinutes: sheet.availableMinutes,
    generationCount: sheet.generationCount,
    status: sheet.status as DailyTaskSheetItem["status"],
    generatedAt: sheet.generatedAt?.toISOString() ?? null,
    closesAt: sheet.closesAt.toISOString(),
    endedAt: sheet.endedAt?.toISOString() ?? null,
    closeReason: sheet.closeReason as DailyTaskSheetItem["closeReason"],
    tasks: sheet.tasks.map(toDailyTaskItem),
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString()
  };
}

export function toDailyConversationItem(
  conversation: DayEvidenceConversation
): DailyConversationItem {
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    messageCount: conversation.messageCount,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  };
}
