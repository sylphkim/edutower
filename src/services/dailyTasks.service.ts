import {
  dailyTaskSheetsRepository,
  isUniqueConstraintError,
  type DailyTaskSheetWithRelations,
  type OwnedProjectSummary
} from "../repositories/dailyTaskSheets.repository";
import type {
  DailySheetHistoryEntry,
  DailyStudyRecord,
  DailyTaskStatusResult
} from "../types/dailyTasks";
import { AppError } from "../utils/errors";
import {
  STUDY_TIMEZONE,
  getLocalDate,
  getLocalDayEnd,
  getLocalDayStart,
  isValidLocalDate
} from "../utils/localDate";
import { logger } from "../utils/logger";
import { dailySummariesService } from "./dailySummaries.service";
import {
  buildCandidates,
  buildGenerationSnapshotEntry,
  candidateDedupeKey,
  selectDailyTasks
} from "./dailyTaskGeneration";
import {
  toDailyConversationItem,
  toDailySheetItem,
  toDailySummaryItem,
  toDailyTaskItem
} from "./dailyTaskMappers";
import { getDemoUserId } from "./demoUser.service";

const DEFAULT_AVAILABLE_MINUTES = 60;
const MIN_AVAILABLE_MINUTES = 15;
const MAX_AVAILABLE_MINUTES = 480;
/** A `generating` sheet older than this is treated as crashed and re-claimed. */
const STALE_GENERATING_MS = 2 * 60 * 1000;
const DEFAULT_HISTORY_LIMIT = 31;
const MAX_HISTORY_LIMIT = 62;
const VALID_TASK_STATUS_UPDATES = new Set(["todo", "in_progress", "done"]);

function normalizeRequiredId(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      `${fieldName} is required and must be a non-empty string.`,
      400
    );
  }

  return value.trim();
}

function clampAvailableMinutes(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return DEFAULT_AVAILABLE_MINUTES;
  }

  return Math.min(MAX_AVAILABLE_MINUTES, Math.max(MIN_AVAILABLE_MINUTES, Math.round(value)));
}

async function ensureOwnedProject(projectIdRaw: unknown): Promise<OwnedProjectSummary> {
  const projectId = normalizeRequiredId(projectIdRaw, "projectId");
  const userId = await getDemoUserId();
  const project = await dailyTaskSheetsRepository.findOwnedProject(projectId, userId);

  if (!project) {
    throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
  }

  return project;
}

function ensureProjectAcceptsDailyStudy(project: OwnedProjectSummary): void {
  if (project.status === "completed" || project.status === "archived") {
    throw new AppError(
      "INVALID_REQUEST",
      "Completed or archived projects cannot start daily study.",
      409
    );
  }
}

async function buildRecord(
  projectId: string,
  localDate: string,
  sheet: DailyTaskSheetWithRelations | null
): Promise<DailyStudyRecord> {
  const evidence = await dailyTaskSheetsRepository.collectDayEvidence(
    projectId,
    getLocalDayStart(localDate),
    getLocalDayEnd(localDate)
  );

  return {
    sheet: sheet ? toDailySheetItem(sheet) : null,
    summary: sheet?.dailySummary ? toDailySummaryItem(sheet.dailySummary) : null,
    conversations: evidence.conversations.map(toDailyConversationItem)
  };
}

function appendGenerationEntry(
  rawSnapshot: string,
  entry: Record<string, unknown>
): string {
  let parsed: Record<string, unknown> = {};

  try {
    const candidate = JSON.parse(rawSnapshot) as unknown;

    if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) {
      parsed = candidate as Record<string, unknown>;
    }
  } catch {
    // Snapshots are service-written JSON; fall back to a fresh object if unreadable.
  }

  const generations = Array.isArray(parsed.generations) ? parsed.generations : [];

  return JSON.stringify({
    ...parsed,
    generations: [...generations, entry]
  });
}

/**
 * Runs one generation round for a sheet: system rules build the candidate
 * pool, the AI ranks within it (with a deterministic fallback), and the
 * result is persisted together with the full decision snapshot.
 */
async function generateInto(
  project: OwnedProjectSummary,
  sheet: DailyTaskSheetWithRelations,
  trigger: "initial" | "regenerate",
  excludeKeys?: Set<string>
): Promise<DailyTaskSheetWithRelations> {
  const now = new Date();
  const inputs = await dailyTaskSheetsRepository.collectGenerationInputs(project.id);
  const built = buildCandidates(inputs, excludeKeys);
  const { selection, meta } = await selectDailyTasks({
    project: {
      title: project.title,
      subject: project.subject,
      goal: project.goal,
      targetScore: project.targetScore
    },
    candidates: built.candidates,
    currentPhaseTitle: built.currentPhaseTitle,
    availableMinutes: sheet.availableMinutes
  });
  const generationBatch =
    trigger === "initial" ? Math.max(sheet.generationCount, 1) : sheet.generationCount + 1;
  const snapshotEntry = buildGenerationSnapshotEntry({
    batch: generationBatch,
    generatedAt: now,
    availableMinutes: sheet.availableMinutes,
    built,
    selection,
    meta,
    trigger
  });
  const payload = {
    sheetId: sheet.id,
    projectId: project.id,
    generationBatch,
    planVersionId: built.planVersionId,
    currentPhaseId: built.currentPhaseId,
    generatedAt: now,
    inputSnapshot: appendGenerationEntry(sheet.inputSnapshot, snapshotEntry),
    tasks: selection.map((item, index) => ({
      title: item.candidate.title,
      type: item.candidate.type,
      order: index,
      knowledgeNodeId: item.candidate.knowledgeNodeId,
      materialId: item.candidate.materialId,
      planPhaseId: item.candidate.planPhaseId,
      carriedFromTaskId: item.candidate.carriedFromTaskId,
      estimatedMinutes: item.candidate.estimatedMinutes,
      sourceType: item.candidate.sourceType,
      selectionReason: item.reason,
      generationBatch
    }))
  };

  return trigger === "initial"
    ? dailyTaskSheetsRepository.completeSheetGeneration(payload)
    : dailyTaskSheetsRepository.regenerateOpenTasks(payload);
}

async function runInitialGeneration(
  project: OwnedProjectSummary,
  sheet: DailyTaskSheetWithRelations
): Promise<DailyTaskSheetWithRelations> {
  try {
    return await generateInto(project, sheet, "initial");
  } catch (error) {
    logger.error(`Daily task generation failed for sheet ${sheet.id}.`, error);
    await dailyTaskSheetsRepository
      .markSheetGenerationFailed(
        sheet.id,
        appendGenerationEntry(sheet.inputSnapshot, {
          batch: Math.max(sheet.generationCount, 1),
          trigger: "initial",
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        })
      )
      .catch((markError) => {
        logger.error(`Failed to mark sheet ${sheet.id} as generation_failed.`, markError);
      });

    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to generate today's tasks. Call POST /api/daily/:projectId/today again to retry.",
      500
    );
  }
}

export const dailyTasksService = {
  /**
   * Idempotent entry point for "user opens the project today": returns the
   * persisted sheet when it exists, otherwise claims the day and generates.
   * Expired sheets from previous days are force-settled first.
   */
  async ensureToday(
    projectIdRaw: unknown
  ): Promise<{ record: DailyStudyRecord; created: boolean }> {
    const project = await ensureOwnedProject(projectIdRaw);
    ensureProjectAcceptsDailyStudy(project);

    const now = new Date();
    await dailySummariesService.forceCloseExpiredSheets(now, project.id);

    const localDate = getLocalDate(now);
    let sheet = await dailyTaskSheetsRepository.findSheetByDate(project.id, localDate);
    let created = false;
    let ownsGeneration = false;

    if (!sheet) {
      try {
        sheet = await dailyTaskSheetsRepository.claimSheet({
          projectId: project.id,
          localDate,
          timezone: STUDY_TIMEZONE,
          availableMinutes: clampAvailableMinutes(project.dailyMinutes),
          closesAt: getLocalDayEnd(localDate)
        });
        created = true;
        ownsGeneration = true;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        sheet = await dailyTaskSheetsRepository.findSheetByDate(project.id, localDate);

        if (!sheet) {
          throw new AppError(
            "INTERNAL_ERROR",
            "Daily task sheet could not be claimed or loaded.",
            500
          );
        }
      }
    }

    if (
      !ownsGeneration &&
      (sheet.status === "generation_failed" ||
        (sheet.status === "generating" &&
          sheet.updatedAt.getTime() < now.getTime() - STALE_GENERATING_MS))
    ) {
      ownsGeneration = await dailyTaskSheetsRepository.reclaimSheetForGeneration(
        sheet.id,
        new Date(now.getTime() - STALE_GENERATING_MS)
      );
    }

    if (ownsGeneration) {
      sheet = await runInitialGeneration(project, sheet);
    }

    return {
      record: await buildRecord(project.id, localDate, sheet),
      created
    };
  },

  /** Read-only view of today's study record; never generates. */
  async getToday(projectIdRaw: unknown): Promise<DailyStudyRecord> {
    const project = await ensureOwnedProject(projectIdRaw);
    const now = new Date();
    await dailySummariesService.forceCloseExpiredSheets(now, project.id);

    const localDate = getLocalDate(now);
    const sheet = await dailyTaskSheetsRepository.findSheetByDate(project.id, localDate);

    return buildRecord(project.id, localDate, sheet);
  },

  async listSheets(
    projectIdRaw: unknown,
    query: { date?: unknown; limit?: unknown }
  ): Promise<{ items: DailySheetHistoryEntry[] }> {
    const project = await ensureOwnedProject(projectIdRaw);

    let localDate: string | undefined;

    if (query.date !== undefined) {
      if (typeof query.date !== "string" || !isValidLocalDate(query.date)) {
        throw new AppError("INVALID_REQUEST", "date must use the YYYY-MM-DD format.", 400);
      }

      localDate = query.date;
    }

    let limit = DEFAULT_HISTORY_LIMIT;

    if (query.limit !== undefined) {
      const parsed = Number.parseInt(String(query.limit), 10);

      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_HISTORY_LIMIT) {
        throw new AppError(
          "INVALID_REQUEST",
          `limit must be an integer between 1 and ${MAX_HISTORY_LIMIT}.`,
          400
        );
      }

      limit = parsed;
    }

    const sheets = await dailyTaskSheetsRepository.listSheets(project.id, {
      localDate,
      limit
    });

    return {
      items: sheets.map((sheet) => ({
        sheet: toDailySheetItem(sheet),
        summary: sheet.dailySummary ? toDailySummaryItem(sheet.dailySummary) : null
      }))
    };
  },

  /**
   * Updates one task's status. When the last open task is done the day is
   * closed automatically and the generated summary is returned inline.
   */
  async updateTaskStatus(
    projectIdRaw: unknown,
    taskIdRaw: unknown,
    input: unknown
  ): Promise<DailyTaskStatusResult> {
    const project = await ensureOwnedProject(projectIdRaw);
    const taskId = normalizeRequiredId(taskIdRaw, "taskId");

    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
    }

    const body = input as Record<string, unknown>;
    const keys = Object.keys(body);

    if (keys.length !== 1 || keys[0] !== "status") {
      throw new AppError(
        "INVALID_REQUEST",
        "PATCH /api/daily/:projectId/tasks/:taskId only accepts status.",
        400
      );
    }

    if (typeof body.status !== "string" || !VALID_TASK_STATUS_UPDATES.has(body.status)) {
      throw new AppError(
        "INVALID_REQUEST",
        "status must be one of: todo, in_progress, done.",
        400
      );
    }

    const now = new Date();
    await dailySummariesService.forceCloseExpiredSheets(now, project.id);

    const result = await dailyTaskSheetsRepository.updateTaskStatus(
      taskId,
      project.id,
      body.status as "todo" | "in_progress" | "done",
      now
    );

    switch (result.status) {
      case "not_found":
        throw new AppError("INVALID_REQUEST", "Daily task not found.", 404);
      case "not_daily_task":
        throw new AppError(
          "INVALID_REQUEST",
          "Task does not belong to a daily task sheet.",
          409
        );
      case "sheet_not_active":
        throw new AppError(
          "INVALID_REQUEST",
          "Tasks can only be updated while the daily sheet is active.",
          409
        );
      case "task_cancelled":
        throw new AppError("INVALID_REQUEST", "Cancelled tasks cannot be updated.", 409);
      case "success":
        break;
    }

    if (result.allDone) {
      const record = await dailySummariesService.closeAndSummarize(
        project.id,
        result.sheetId,
        "all_tasks_done",
        now
      );

      if (!record.sheet) {
        throw new AppError("INTERNAL_ERROR", "Closed sheet could not be reloaded.", 500);
      }

      return {
        task: toDailyTaskItem(result.task),
        sheet: record.sheet,
        summary: record.summary,
        autoClosed: true
      };
    }

    const sheet = await dailyTaskSheetsRepository.findSheetById(result.sheetId, project.id);

    if (!sheet) {
      throw new AppError("INTERNAL_ERROR", "Daily task sheet could not be reloaded.", 500);
    }

    return {
      task: toDailyTaskItem(result.task),
      sheet: toDailySheetItem(sheet),
      summary: sheet.dailySummary ? toDailySummaryItem(sheet.dailySummary) : null,
      autoClosed: false
    };
  },

  /**
   * Re-plans today's open tasks on user request: done tasks stay, open tasks
   * are cancelled, and a new batch is generated from the current candidates.
   */
  async regenerateToday(projectIdRaw: unknown): Promise<DailyStudyRecord> {
    const project = await ensureOwnedProject(projectIdRaw);
    const now = new Date();
    await dailySummariesService.forceCloseExpiredSheets(now, project.id);

    const localDate = getLocalDate(now);
    const sheet = await dailyTaskSheetsRepository.findSheetByDate(project.id, localDate);

    if (!sheet) {
      throw new AppError("INVALID_REQUEST", "No daily task sheet exists for today.", 404);
    }

    if (sheet.status !== "active") {
      throw new AppError(
        "INVALID_REQUEST",
        "Only an active daily task sheet can be regenerated.",
        409
      );
    }

    const excludeKeys = new Set(
      sheet.tasks
        .filter((task) => task.status === "done")
        .map((task) => candidateDedupeKey(task.type, task.knowledgeNodeId))
    );
    const updated = await generateInto(project, sheet, "regenerate", excludeKeys);

    return buildRecord(project.id, localDate, updated);
  },

  /** User-initiated end of today's study. */
  async closeToday(projectIdRaw: unknown): Promise<DailyStudyRecord> {
    const project = await ensureOwnedProject(projectIdRaw);
    const now = new Date();
    await dailySummariesService.forceCloseExpiredSheets(now, project.id);

    const localDate = getLocalDate(now);
    const sheet = await dailyTaskSheetsRepository.findSheetByDate(project.id, localDate);

    if (!sheet) {
      throw new AppError("INVALID_REQUEST", "No daily task sheet exists for today.", 404);
    }

    if (sheet.status !== "active") {
      throw new AppError(
        "INVALID_REQUEST",
        "Today's study is already closed or has not finished generating.",
        409
      );
    }

    return dailySummariesService.closeAndSummarize(project.id, sheet.id, "user", now);
  },

  /** Applies suggestion decisions for a summary; see dailySummaries.service. */
  async decideSummary(
    projectIdRaw: unknown,
    summaryIdRaw: unknown,
    input: unknown
  ): Promise<ReturnType<typeof dailySummariesService.decide>> {
    const project = await ensureOwnedProject(projectIdRaw);
    const summaryId = normalizeRequiredId(summaryIdRaw, "summaryId");

    return dailySummariesService.decide(project.id, summaryId, input);
  }
};
