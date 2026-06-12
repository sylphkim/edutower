import { prisma } from "../lib/prisma";
import { applyLearningStateChangeWithinTransaction } from "./knowledgeNodes.repository";
import type {
  DailySummaryConfirmationSource,
  DailyTaskSheetCloseReason,
  DailyTaskSheetStatus,
  KnowledgeNodeLearningState,
  StudyTask,
  StudyTaskSource,
  StudyTaskType,
  SummarySuggestionType,
  WeakPointSeverity
} from "../generated/prisma/client";
import type {
  DailyTaskSheetGetPayload,
  DailyTaskSheetInclude,
  DailySummaryGetPayload,
  DailySummaryInclude,
  StudyPlanVersionGetPayload,
  StudyPlanVersionInclude
} from "../generated/prisma/models";

const sheetInclude = {
  tasks: {
    orderBy: [
      { order: "asc" },
      { createdAt: "asc" },
      { id: "asc" }
    ]
  },
  dailySummary: {
    include: {
      suggestions: {
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" }
        ]
      }
    }
  }
} satisfies DailyTaskSheetInclude;

const summaryInclude = {
  suggestions: {
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" }
    ]
  }
} satisfies DailySummaryInclude;

const generationPlanInclude = {
  phases: {
    include: {
      knowledgeNodeLinks: {
        orderBy: [
          { order: "asc" },
          { createdAt: "asc" }
        ]
      }
    },
    orderBy: [
      { order: "asc" },
      { createdAt: "asc" }
    ]
  }
} satisfies StudyPlanVersionInclude;

export type DailyTaskSheetWithRelations = DailyTaskSheetGetPayload<{
  include: typeof sheetInclude;
}>;

export type DailySummaryWithSuggestions = DailySummaryGetPayload<{
  include: typeof summaryInclude;
}>;

export type GenerationPlanVersion = StudyPlanVersionGetPayload<{
  include: typeof generationPlanInclude;
}>;

export interface OwnedProjectSummary {
  id: string;
  title: string;
  subject: string;
  goal: string;
  targetScore: string | null;
  deadline: Date | null;
  dailyMinutes: number | null;
  status: string;
}

export interface GenerationKnowledgeNode {
  id: string;
  title: string;
  learningState: KnowledgeNodeLearningState;
  isUnlocked: boolean;
  mastery: number;
  order: number;
  createdAt: Date;
}

export interface GenerationWeakPoint {
  id: string;
  knowledgeNodeId: string;
  title: string;
  description: string | null;
  severity: WeakPointSeverity;
}

export interface GenerationWrongbookGroup {
  knowledgeNodeId: string | null;
  count: number;
}

export interface GenerationInputs {
  confirmedPlan: GenerationPlanVersion | null;
  nodes: GenerationKnowledgeNode[];
  weakPoints: GenerationWeakPoint[];
  wrongbookGroups: GenerationWrongbookGroup[];
  previousUnfinishedTasks: StudyTask[];
}

export interface CreateDailyTaskRecordInput {
  title: string;
  type: StudyTaskType;
  order: number;
  knowledgeNodeId?: string;
  materialId?: string;
  planPhaseId?: string;
  carriedFromTaskId?: string;
  estimatedMinutes: number;
  sourceType: StudyTaskSource;
  selectionReason: string;
  generationBatch: number;
}

export interface CompleteSheetGenerationInput {
  sheetId: string;
  projectId: string;
  generationBatch: number;
  planVersionId: string | null;
  currentPhaseId: string | null;
  generatedAt: Date;
  inputSnapshot: string;
  tasks: CreateDailyTaskRecordInput[];
}

export interface DayEvidenceQuizAttempt {
  knowledgeNodeId: string;
  isCorrect: boolean;
}

export interface DayEvidenceWrongbookItem {
  id: string;
  knowledgeNodeId: string | null;
}

export interface DayEvidenceConversation {
  id: string;
  type: string;
  title: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DayConversationMessage {
  role: string;
  content: string;
}

export interface DayConversationTranscript {
  id: string;
  type: string;
  title: string | null;
  messages: DayConversationMessage[];
}

export interface ActiveWeakPoint {
  id: string;
  knowledgeNodeId: string;
  title: string;
  severity: WeakPointSeverity;
}

export interface DayEvidence {
  quizAttempts: DayEvidenceQuizAttempt[];
  newWrongbookItems: DayEvidenceWrongbookItem[];
  conversations: DayEvidenceConversation[];
}

export interface CreateSuggestionRecordInput {
  type: SummarySuggestionType;
  knowledgeNodeId?: string;
  studyTaskId?: string;
  content: string;
  proposedLearningState?: KnowledgeNodeLearningState;
  proposedMastery?: number;
}

export interface CloseSheetSummaryInput {
  summaryDate: Date;
  aiDraft: string;
  weaknesses?: string;
  status: "awaiting_confirmation" | "confirmed";
  confirmationSource?: DailySummaryConfirmationSource;
  confirmedAt?: Date;
  confirmedContent?: string;
}

export interface CloseSheetInput {
  sheetId: string;
  projectId: string;
  userId: string;
  closeReason: DailyTaskSheetCloseReason;
  endedAt: Date;
  sheetStatus: "awaiting_confirmation" | "completed" | "forced_closed";
  summary: CloseSheetSummaryInput;
  suggestions: CreateSuggestionRecordInput[];
}

export type CloseSheetResult =
  | { status: "success"; summaryId: string }
  | { status: "not_active" }
  | { status: "not_found" };

export interface SuggestionDecisionRecord {
  suggestionId: string;
  action: "accept" | "modify" | "reject";
  modifiedContent?: string;
  /** Resolved learning state to apply (override already merged by the service). */
  targetLearningState?: KnowledgeNodeLearningState;
  /** Resolved mastery to apply, already clamped by the service. */
  targetMastery?: number;
  weaknessTitle?: string;
  weaknessDescription?: string;
  weaknessSeverity?: WeakPointSeverity;
  evidenceSnapshot: Record<string, unknown>;
}

export interface DecideSuggestionsInputRecord {
  summaryId: string;
  projectId: string;
  decisions: SuggestionDecisionRecord[];
  decisionSource: "user" | "system_forced";
  decidedAt: Date;
  /** Sheet status to apply once every suggestion is decided. */
  finalSheetStatus: "completed" | "forced_closed";
  confirmedContentOverride?: string;
}

export type DecideSuggestionsRepositoryResult =
  | { status: "success"; summaryConfirmed: boolean; sheetId: string | null }
  | { status: "not_found" }
  | { status: "not_awaiting" }
  | { status: "unknown_suggestion"; suggestionId: string }
  | { status: "suggestion_not_pending"; suggestionId: string };

const OPEN_TASK_STATUSES = ["todo", "in_progress"] as const;
const EXPIRABLE_SHEET_STATUSES = [
  "generating",
  "active",
  "awaiting_confirmation",
  "generation_failed"
] as const satisfies readonly DailyTaskSheetStatus[];

export const dailyTaskSheetsRepository = {
  findOwnedProject(projectId: string, userId: string): Promise<OwnedProjectSummary | null> {
    return prisma.studyProject.findFirst({
      where: {
        id: projectId,
        userId
      },
      select: {
        id: true,
        title: true,
        subject: true,
        goal: true,
        targetScore: true,
        deadline: true,
        dailyMinutes: true,
        status: true
      }
    });
  },

  /** System-path lookup without user scoping; used by the midnight sweeper. */
  findProjectById(projectId: string): Promise<OwnedProjectSummary | null> {
    return prisma.studyProject.findFirst({
      where: {
        id: projectId
      },
      select: {
        id: true,
        title: true,
        subject: true,
        goal: true,
        targetScore: true,
        deadline: true,
        dailyMinutes: true,
        status: true
      }
    });
  },

  findSheetByDate(
    projectId: string,
    localDate: string
  ): Promise<DailyTaskSheetWithRelations | null> {
    return prisma.dailyTaskSheet.findFirst({
      where: {
        projectId,
        localDate
      },
      include: sheetInclude
    });
  },

  findSheetById(
    sheetId: string,
    projectId: string
  ): Promise<DailyTaskSheetWithRelations | null> {
    return prisma.dailyTaskSheet.findFirst({
      where: {
        id: sheetId,
        projectId
      },
      include: sheetInclude
    });
  },

  listSheets(
    projectId: string,
    options: { localDate?: string; limit: number }
  ): Promise<DailyTaskSheetWithRelations[]> {
    return prisma.dailyTaskSheet.findMany({
      where: {
        projectId,
        ...(options.localDate ? { localDate: options.localDate } : {})
      },
      include: sheetInclude,
      orderBy: [
        { localDate: "desc" },
        { createdAt: "desc" }
      ],
      take: options.limit
    });
  },

  /**
   * Claims the unique (projectId, localDate) slot by creating the sheet in
   * `generating` state. A P2002 unique violation means another request claimed
   * it first; callers should re-read the existing sheet.
   */
  claimSheet(input: {
    projectId: string;
    localDate: string;
    timezone: string;
    availableMinutes: number;
    closesAt: Date;
  }): Promise<DailyTaskSheetWithRelations> {
    return prisma.dailyTaskSheet.create({
      data: {
        projectId: input.projectId,
        localDate: input.localDate,
        timezone: input.timezone,
        availableMinutes: input.availableMinutes,
        closesAt: input.closesAt,
        status: "generating"
      },
      include: sheetInclude
    });
  },

  /**
   * Re-claims a sheet whose previous generation failed or stalled. Returns
   * true when this caller owns the new generation attempt.
   */
  async reclaimSheetForGeneration(sheetId: string, staleBefore: Date): Promise<boolean> {
    const result = await prisma.dailyTaskSheet.updateMany({
      where: {
        id: sheetId,
        OR: [
          { status: "generation_failed" },
          {
            status: "generating",
            updatedAt: {
              lt: staleBefore
            }
          }
        ]
      },
      data: {
        status: "generating",
        updatedAt: new Date()
      }
    });

    return result.count === 1;
  },

  async collectGenerationInputs(projectId: string): Promise<GenerationInputs> {
    const [confirmedPlan, nodes, weakPoints, wrongbookItems, previousSheet] =
      await Promise.all([
        prisma.studyPlanVersion.findFirst({
          where: {
            projectId,
            status: "confirmed"
          },
          include: generationPlanInclude,
          orderBy: [
            { version: "desc" },
            { confirmedAt: "desc" }
          ]
        }),
        prisma.knowledgeNode.findMany({
          where: {
            projectId,
            archivedAt: null
          },
          select: {
            id: true,
            title: true,
            learningState: true,
            isUnlocked: true,
            mastery: true,
            order: true,
            createdAt: true
          },
          orderBy: [
            { order: "asc" },
            { createdAt: "asc" },
            { id: "asc" }
          ]
        }),
        prisma.weakPoint.findMany({
          where: {
            projectId,
            status: "active"
          },
          select: {
            id: true,
            knowledgeNodeId: true,
            title: true,
            description: true,
            severity: true
          },
          orderBy: [
            { createdAt: "asc" },
            { id: "asc" }
          ]
        }),
        prisma.wrongbookItem.findMany({
          where: {
            projectId,
            deletedAt: null,
            status: "uncorrected"
          },
          select: {
            knowledgeNodeId: true
          }
        }),
        prisma.dailyTaskSheet.findFirst({
          where: {
            projectId,
            status: {
              in: ["completed", "forced_closed", "awaiting_confirmation"]
            }
          },
          include: {
            tasks: {
              where: {
                status: {
                  in: [...OPEN_TASK_STATUSES]
                }
              },
              orderBy: [
                { order: "asc" },
                { createdAt: "asc" }
              ]
            }
          },
          orderBy: [
            { localDate: "desc" },
            { createdAt: "desc" }
          ]
        })
      ]);

    const wrongbookCounts = new Map<string | null, number>();
    for (const item of wrongbookItems) {
      const key = item.knowledgeNodeId;
      wrongbookCounts.set(key, (wrongbookCounts.get(key) ?? 0) + 1);
    }

    return {
      confirmedPlan,
      nodes,
      weakPoints,
      wrongbookGroups: Array.from(wrongbookCounts.entries()).map(
        ([knowledgeNodeId, count]) => ({ knowledgeNodeId, count })
      ),
      previousUnfinishedTasks: previousSheet?.tasks ?? []
    };
  },

  async completeSheetGeneration(
    input: CompleteSheetGenerationInput
  ): Promise<DailyTaskSheetWithRelations> {
    await prisma.$transaction(async (tx) => {
      if (input.tasks.length > 0) {
        await tx.studyTask.createMany({
          data: input.tasks.map((task) => ({
            projectId: input.projectId,
            dailyTaskSheetId: input.sheetId,
            title: task.title,
            type: task.type,
            order: task.order,
            knowledgeNodeId: task.knowledgeNodeId,
            materialId: task.materialId,
            planPhaseId: task.planPhaseId,
            carriedFromTaskId: task.carriedFromTaskId,
            estimatedMinutes: task.estimatedMinutes,
            sourceType: task.sourceType,
            selectionReason: task.selectionReason,
            generationBatch: task.generationBatch,
            isRecommended: true,
            isSelected: true,
            status: "todo"
          }))
        });
      }

      await tx.dailyTaskSheet.update({
        where: {
          id: input.sheetId
        },
        data: {
          status: "active",
          generatedAt: input.generatedAt,
          generationCount: input.generationBatch,
          planVersionId: input.planVersionId,
          currentPhaseId: input.currentPhaseId,
          inputSnapshot: input.inputSnapshot
        }
      });
    });

    return this.findSheetById(
      input.sheetId,
      input.projectId
    ) as Promise<DailyTaskSheetWithRelations>;
  },

  async markSheetGenerationFailed(sheetId: string, inputSnapshot: string): Promise<void> {
    await prisma.dailyTaskSheet.updateMany({
      where: {
        id: sheetId,
        status: "generating"
      },
      data: {
        status: "generation_failed",
        inputSnapshot
      }
    });
  },

  async regenerateOpenTasks(
    input: CompleteSheetGenerationInput
  ): Promise<DailyTaskSheetWithRelations> {
    await prisma.$transaction(async (tx) => {
      await tx.studyTask.updateMany({
        where: {
          dailyTaskSheetId: input.sheetId,
          status: {
            in: [...OPEN_TASK_STATUSES]
          }
        },
        data: {
          status: "cancelled"
        }
      });

      if (input.tasks.length > 0) {
        await tx.studyTask.createMany({
          data: input.tasks.map((task) => ({
            projectId: input.projectId,
            dailyTaskSheetId: input.sheetId,
            title: task.title,
            type: task.type,
            order: task.order,
            knowledgeNodeId: task.knowledgeNodeId,
            materialId: task.materialId,
            planPhaseId: task.planPhaseId,
            carriedFromTaskId: task.carriedFromTaskId,
            estimatedMinutes: task.estimatedMinutes,
            sourceType: task.sourceType,
            selectionReason: task.selectionReason,
            generationBatch: task.generationBatch,
            isRecommended: true,
            isSelected: true,
            status: "todo"
          }))
        });
      }

      await tx.dailyTaskSheet.update({
        where: {
          id: input.sheetId
        },
        data: {
          generatedAt: input.generatedAt,
          generationCount: input.generationBatch,
          planVersionId: input.planVersionId,
          currentPhaseId: input.currentPhaseId,
          inputSnapshot: input.inputSnapshot
        }
      });
    });

    return this.findSheetById(
      input.sheetId,
      input.projectId
    ) as Promise<DailyTaskSheetWithRelations>;
  },

  async updateTaskStatus(
    taskId: string,
    projectId: string,
    status: "todo" | "in_progress" | "done",
    now: Date
  ): Promise<
    | { status: "success"; task: StudyTask; sheetId: string; allDone: boolean }
    | { status: "not_found" | "not_daily_task" | "sheet_not_active" | "task_cancelled" }
  > {
    return prisma.$transaction(async (tx) => {
      const task = await tx.studyTask.findFirst({
        where: {
          id: taskId,
          projectId
        },
        include: {
          dailyTaskSheet: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      if (!task) {
        return { status: "not_found" as const };
      }

      if (!task.dailyTaskSheet) {
        return { status: "not_daily_task" as const };
      }

      if (task.dailyTaskSheet.status !== "active") {
        return { status: "sheet_not_active" as const };
      }

      if (task.status === "cancelled") {
        return { status: "task_cancelled" as const };
      }

      const updatedTask = await tx.studyTask.update({
        where: {
          id: taskId
        },
        data: {
          status,
          completedAt: status === "done" ? now : null
        }
      });

      const [openCount, doneCount] = await Promise.all([
        tx.studyTask.count({
          where: {
            dailyTaskSheetId: task.dailyTaskSheet.id,
            status: {
              in: [...OPEN_TASK_STATUSES]
            }
          }
        }),
        tx.studyTask.count({
          where: {
            dailyTaskSheetId: task.dailyTaskSheet.id,
            status: "done"
          }
        })
      ]);

      return {
        status: "success" as const,
        task: updatedTask,
        sheetId: task.dailyTaskSheet.id,
        allDone: openCount === 0 && doneCount > 0
      };
    });
  },

  async collectDayEvidence(
    projectId: string,
    dayStart: Date,
    dayEnd: Date
  ): Promise<DayEvidence> {
    const [attempts, wrongbookItems, conversations] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: {
          answeredAt: {
            gte: dayStart,
            lt: dayEnd
          },
          question: {
            quiz: {
              knowledgeNode: {
                projectId
              }
            }
          }
        },
        select: {
          isCorrect: true,
          question: {
            select: {
              quiz: {
                select: {
                  knowledgeNodeId: true
                }
              }
            }
          }
        }
      }),
      prisma.wrongbookItem.findMany({
        where: {
          projectId,
          deletedAt: null,
          createdAt: {
            gte: dayStart,
            lt: dayEnd
          }
        },
        select: {
          id: true,
          knowledgeNodeId: true
        }
      }),
      prisma.conversation.findMany({
        where: {
          projectId,
          createdAt: {
            lt: dayEnd
          },
          updatedAt: {
            gte: dayStart
          }
        },
        select: {
          id: true,
          type: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" }
        ]
      })
    ]);

    return {
      quizAttempts: attempts.map((attempt) => ({
        knowledgeNodeId: attempt.question.quiz.knowledgeNodeId,
        isCorrect: attempt.isCorrect
      })),
      newWrongbookItems: wrongbookItems,
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        type: conversation.type,
        title: conversation.title,
        messageCount: conversation._count.messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }))
    };
  },

  /**
   * 取当天有活动的对话的消息正文，供每日总结使用。与 collectDayEvidence 用
   * 同一时间窗，但只在总结路径调用（GET 当天记录不需要正文，避免拖慢热路径）。
   * 每段对话按时间倒序取最近 N 条，再翻回正序还原顺序。
   */
  async collectDayConversationMessages(
    projectId: string,
    dayStart: Date,
    dayEnd: Date,
    maxMessagesPerConversation = 40
  ): Promise<DayConversationTranscript[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        projectId,
        createdAt: { lt: dayEnd },
        updatedAt: { gte: dayStart }
      },
      select: {
        id: true,
        type: true,
        title: true,
        messages: {
          where: {
            createdAt: { gte: dayStart, lt: dayEnd }
          },
          select: { role: true, content: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: maxMessagesPerConversation
        }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    return conversations
      .filter((conversation) => conversation.messages.length > 0)
      .map((conversation) => ({
        id: conversation.id,
        type: conversation.type,
        title: conversation.title,
        messages: conversation.messages
          .slice()
          .reverse()
          .map((message) => ({ role: message.role, content: message.content }))
      }));
  },

  // 取项目当前所有 active 薄弱点，作为「今日战况」薄弱点 delta 的基线
  // （结束今日那一刻，今天的建议还没确认，所以这就是「今天之前」的状态）。
  async collectActiveWeakPoints(projectId: string): Promise<ActiveWeakPoint[]> {
    return prisma.weakPoint.findMany({
      where: {
        projectId,
        status: "active"
      },
      select: {
        id: true,
        knowledgeNodeId: true,
        title: true,
        severity: true
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
  },

  async closeSheet(input: CloseSheetInput): Promise<CloseSheetResult> {
    return prisma.$transaction(async (tx) => {
      const sheet = await tx.dailyTaskSheet.findFirst({
        where: {
          id: input.sheetId,
          projectId: input.projectId
        },
        select: {
          id: true,
          status: true
        }
      });

      if (!sheet) {
        return { status: "not_found" as const };
      }

      if (sheet.status !== "active") {
        return { status: "not_active" as const };
      }

      await tx.dailyTaskSheet.update({
        where: {
          id: input.sheetId
        },
        data: {
          status: input.sheetStatus,
          endedAt: input.endedAt,
          closeReason: input.closeReason
        }
      });

      const summary = await tx.dailySummary.create({
        data: {
          userId: input.userId,
          projectId: input.projectId,
          dailyTaskSheetId: input.sheetId,
          summaryDate: input.summary.summaryDate,
          aiDraft: input.summary.aiDraft,
          weaknesses: input.summary.weaknesses,
          status: input.summary.status,
          confirmationSource: input.summary.confirmationSource,
          confirmedAt: input.summary.confirmedAt,
          confirmedContent: input.summary.confirmedContent,
          suggestions: {
            create: input.suggestions.map((suggestion) => ({
              type: suggestion.type,
              knowledgeNodeId: suggestion.knowledgeNodeId,
              studyTaskId: suggestion.studyTaskId,
              content: suggestion.content,
              proposedLearningState: suggestion.proposedLearningState,
              proposedMastery: suggestion.proposedMastery
            }))
          }
        },
        select: {
          id: true
        }
      });

      return { status: "success" as const, summaryId: summary.id };
    });
  },

  findSummaryById(
    summaryId: string,
    projectId: string
  ): Promise<DailySummaryWithSuggestions | null> {
    return prisma.dailySummary.findFirst({
      where: {
        id: summaryId,
        projectId
      },
      include: summaryInclude
    });
  },

  async decideSuggestions(
    input: DecideSuggestionsInputRecord
  ): Promise<DecideSuggestionsRepositoryResult> {
    return prisma.$transaction(async (tx) => {
      const summary = await tx.dailySummary.findFirst({
        where: {
          id: input.summaryId,
          projectId: input.projectId
        },
        include: {
          suggestions: true,
          dailyTaskSheet: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      if (!summary) {
        return { status: "not_found" as const };
      }

      if (summary.status !== "awaiting_confirmation") {
        return { status: "not_awaiting" as const };
      }

      const suggestionMap = new Map(
        summary.suggestions.map((suggestion) => [suggestion.id, suggestion])
      );

      for (const decision of input.decisions) {
        const suggestion = suggestionMap.get(decision.suggestionId);

        if (!suggestion) {
          return {
            status: "unknown_suggestion" as const,
            suggestionId: decision.suggestionId
          };
        }

        if (suggestion.status !== "pending") {
          return {
            status: "suggestion_not_pending" as const,
            suggestionId: decision.suggestionId
          };
        }
      }

      for (const decision of input.decisions) {
        const suggestion = suggestionMap.get(decision.suggestionId)!;
        const decidedStatus =
          decision.action === "accept"
            ? "accepted"
            : decision.action === "modify"
              ? "modified"
              : "rejected";

        await tx.summarySuggestion.update({
          where: {
            id: suggestion.id
          },
          data: {
            status: decidedStatus,
            modifiedContent: decision.modifiedContent,
            decisionSource: input.decisionSource,
            decidedAt: input.decidedAt
          }
        });

        if (decision.action === "reject") {
          continue;
        }

        if (suggestion.type === "knowledge_status" && suggestion.knowledgeNodeId) {
          const node = await tx.knowledgeNode.findFirst({
            where: {
              id: suggestion.knowledgeNodeId,
              projectId: input.projectId,
              archivedAt: null
            },
            select: {
              id: true,
              learningState: true,
              mastery: true,
              isUnlocked: true
            }
          });

          if (!node) {
            continue;
          }

          const previousLearningState = node.learningState;
          const previousMastery = node.mastery;
          let appliedLearningState: KnowledgeNodeLearningState | null = null;

          if (
            decision.targetLearningState &&
            decision.targetLearningState !== node.learningState
          ) {
            const result = await applyLearningStateChangeWithinTransaction(
              tx,
              node.id,
              input.projectId,
              decision.targetLearningState
            );

            if (result.status === "success") {
              appliedLearningState = decision.targetLearningState;
            }
          }

          let appliedMastery: number | null = null;

          if (
            decision.targetMastery !== undefined &&
            decision.targetMastery !== node.mastery
          ) {
            await tx.knowledgeNode.update({
              where: {
                id: node.id
              },
              data: {
                mastery: decision.targetMastery
              }
            });
            appliedMastery = decision.targetMastery;
          }

          if (appliedLearningState !== null || appliedMastery !== null) {
            await tx.knowledgeStateEvent.create({
              data: {
                projectId: input.projectId,
                knowledgeNodeId: node.id,
                dailyTaskSheetId: summary.dailyTaskSheetId,
                summarySuggestionId: suggestion.id,
                previousLearningState,
                newLearningState: appliedLearningState ?? previousLearningState,
                previousMastery,
                newMastery: appliedMastery ?? previousMastery,
                source:
                  input.decisionSource === "user" ? "user_confirmation" : "system_forced",
                evidenceSnapshot: JSON.stringify(decision.evidenceSnapshot)
              }
            });
          }
        }

        if (suggestion.type === "weakness" && suggestion.knowledgeNodeId) {
          const severity = decision.weaknessSeverity ?? "medium";
          const evidenceSnapshot = JSON.stringify(decision.evidenceSnapshot);
          const existing = await tx.weakPoint.findFirst({
            where: {
              projectId: input.projectId,
              knowledgeNodeId: suggestion.knowledgeNodeId,
              status: "active"
            },
            select: {
              id: true
            }
          });

          if (existing) {
            await tx.weakPoint.update({
              where: {
                id: existing.id
              },
              data: {
                title: decision.weaknessTitle ?? undefined,
                description: decision.weaknessDescription,
                severity,
                dailyTaskSheetId: summary.dailyTaskSheetId,
                evidenceSnapshot,
                confirmationSource:
                  input.decisionSource === "user" ? "user" : "system_forced",
                confirmedAt: input.decidedAt
              }
            });
          } else {
            await tx.weakPoint.create({
              data: {
                projectId: input.projectId,
                knowledgeNodeId: suggestion.knowledgeNodeId,
                dailyTaskSheetId: summary.dailyTaskSheetId,
                title: decision.weaknessTitle ?? "薄弱点",
                description: decision.weaknessDescription,
                severity,
                status: "active",
                evidenceSnapshot,
                confirmationSource:
                  input.decisionSource === "user" ? "user" : "system_forced",
                confirmedAt: input.decidedAt
              }
            });
          }
        }

        if (suggestion.type === "weakness_resolved" && suggestion.knowledgeNodeId) {
          // 接受「建议解决」：把该节点当前 active 的薄弱点置为已解决。
          await tx.weakPoint.updateMany({
            where: {
              projectId: input.projectId,
              knowledgeNodeId: suggestion.knowledgeNodeId,
              status: "active"
            },
            data: {
              status: "resolved",
              resolvedAt: input.decidedAt
            }
          });
        }
      }

      const pendingCount = await tx.summarySuggestion.count({
        where: {
          summaryId: summary.id,
          status: "pending"
        }
      });

      if (pendingCount === 0) {
        await tx.dailySummary.update({
          where: {
            id: summary.id
          },
          data: {
            status: "confirmed",
            confirmedAt: input.decidedAt,
            confirmationSource:
              input.decisionSource === "user" ? "user" : "system_forced",
            confirmedContent: input.confirmedContentOverride ?? summary.aiDraft
          }
        });

        if (
          summary.dailyTaskSheet &&
          summary.dailyTaskSheet.status === "awaiting_confirmation"
        ) {
          await tx.dailyTaskSheet.update({
            where: {
              id: summary.dailyTaskSheet.id
            },
            data: {
              status: input.finalSheetStatus
            }
          });
        }
      }

      return {
        status: "success" as const,
        summaryConfirmed: pendingCount === 0,
        sheetId: summary.dailyTaskSheet?.id ?? null
      };
    });
  },

  findExpiredSheets(
    now: Date,
    projectId?: string
  ): Promise<DailyTaskSheetWithRelations[]> {
    return prisma.dailyTaskSheet.findMany({
      where: {
        closesAt: {
          lte: now
        },
        status: {
          in: [...EXPIRABLE_SHEET_STATUSES]
        },
        ...(projectId ? { projectId } : {})
      },
      include: sheetInclude,
      orderBy: [
        { closesAt: "asc" },
        { id: "asc" }
      ],
      take: 20
    });
  },

  /** Closes an expired sheet that never finished generating; no summary is created. */
  async forceCloseUngeneratedSheet(sheetId: string, endedAt: Date): Promise<boolean> {
    const result = await prisma.dailyTaskSheet.updateMany({
      where: {
        id: sheetId,
        status: {
          in: ["generating", "generation_failed"]
        }
      },
      data: {
        status: "forced_closed",
        endedAt,
        closeReason: "midnight"
      }
    });

    return result.count === 1;
  }
};

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
