import {
  PlanVersionRepositoryConflictError,
  isUniqueConstraintError,
  planVersionsRepository,
  type PlanVersionWithPhases
} from "../repositories/planVersions.repository";
import type {
  PlanPhaseInput,
  PlanVersionItem,
  StudyPlanVersionStatus,
  UpdatePlanVersionInput
} from "../types/planVersion";
import { AppError } from "../utils/errors";
import { getDemoUserId } from "./demo.service";

const CREATE_KEYS = new Set(["inputSnapshot", "phases"]);
const UPDATE_KEYS = new Set(["phases"]);
const PHASE_KEYS = new Set([
  "title",
  "goal",
  "description",
  "completionCriteria",
  "knowledgeNodeIds"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>, label: string): void {
  const invalidKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (invalidKeys.length > 0) {
    throw new AppError(
      "INVALID_REQUEST",
      `${label} contains unsupported fields: ${invalidKeys.join(", ")}.`,
      400
    );
  }
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError("INVALID_REQUEST", `${fieldName} must be a string.`, 400);
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      `${fieldName} is required and must be a non-empty string.`,
      400
    );
  }

  return value.trim();
}

function normalizeKnowledgeNodeIds(value: unknown, phaseIndex: number): string[] {
  if (!Array.isArray(value)) {
    throw new AppError(
      "INVALID_REQUEST",
      `phases[${phaseIndex}].knowledgeNodeIds must be an array.`,
      400
    );
  }

  const normalizedIds = value.map((id, knowledgeNodeIndex) =>
    normalizeRequiredString(
      id,
      `phases[${phaseIndex}].knowledgeNodeIds[${knowledgeNodeIndex}]`
    )
  );

  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw new AppError(
      "INVALID_REQUEST",
      `phases[${phaseIndex}].knowledgeNodeIds cannot contain duplicates.`,
      400
    );
  }

  return normalizedIds;
}

function normalizePhases(value: unknown): PlanPhaseInput[] {
  if (!Array.isArray(value)) {
    throw new AppError("INVALID_REQUEST", "phases must be an array.", 400);
  }

  return value.map((phase, index) => {
    if (!isRecord(phase)) {
      throw new AppError("INVALID_REQUEST", `phases[${index}] must be an object.`, 400);
    }

    ensureOnlyKeys(phase, PHASE_KEYS, `phases[${index}]`);

    return {
      title: normalizeRequiredString(phase.title, `phases[${index}].title`),
      goal: normalizeRequiredString(phase.goal, `phases[${index}].goal`),
      description: normalizeOptionalString(
        phase.description,
        `phases[${index}].description`
      ),
      completionCriteria: normalizeOptionalString(
        phase.completionCriteria,
        `phases[${index}].completionCriteria`
      ),
      knowledgeNodeIds: normalizeKnowledgeNodeIds(phase.knowledgeNodeIds, index)
    };
  });
}

function normalizeCreateInput(input: unknown): {
  inputSnapshot: Record<string, unknown>;
  phases: PlanPhaseInput[];
} {
  if (!isRecord(input)) {
    throw new AppError("INVALID_REQUEST", "Request body must be an object.", 400);
  }

  ensureOnlyKeys(input, CREATE_KEYS, "Request body");

  if (input.inputSnapshot !== undefined && !isRecord(input.inputSnapshot)) {
    throw new AppError("INVALID_REQUEST", "inputSnapshot must be a JSON object.", 400);
  }

  return {
    inputSnapshot: (input.inputSnapshot as Record<string, unknown> | undefined) ?? {},
    phases: input.phases === undefined ? [] : normalizePhases(input.phases)
  };
}

function normalizeUpdateInput(input: unknown): UpdatePlanVersionInput {
  if (!isRecord(input)) {
    throw new AppError("INVALID_REQUEST", "Request body must be an object.", 400);
  }

  ensureOnlyKeys(input, UPDATE_KEYS, "Request body");

  if (!("phases" in input)) {
    throw new AppError("INVALID_REQUEST", "phases is required.", 400);
  }

  return {
    phases: normalizePhases(input.phases)
  };
}

function collectKnowledgeNodeIds(phases: PlanPhaseInput[]): string[] {
  return Array.from(new Set(phases.flatMap((phase) => phase.knowledgeNodeIds)));
}

async function ensureOwnedProject(projectId: string): Promise<string> {
  const normalizedProjectId = normalizeRequiredString(projectId, "projectId");
  const userId = await getDemoUserId();
  const project = await planVersionsRepository.findOwnedProject(normalizedProjectId, userId);

  if (!project) {
    throw new AppError("INVALID_REQUEST", "Study project not found.", 404);
  }

  return normalizedProjectId;
}

async function ensureActiveKnowledgeNodes(
  phases: PlanPhaseInput[],
  projectId: string
): Promise<void> {
  const ids = collectKnowledgeNodeIds(phases);

  if (ids.length === 0) {
    return;
  }

  const count = await planVersionsRepository.countActiveKnowledgeNodesByIds(ids, projectId);

  if (count !== ids.length) {
    throw new AppError(
      "INVALID_REQUEST",
      "knowledgeNodeIds must reference active knowledge nodes in the same project.",
      400
    );
  }
}

function parseInputSnapshot(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    // Persisted snapshots are written by this service and must remain valid JSON objects.
  }

  throw new AppError("INTERNAL_ERROR", "Stored plan input snapshot is invalid.", 500);
}

export function toPlanVersionItem(item: PlanVersionWithPhases): PlanVersionItem {
  return {
    id: item.id,
    projectId: item.projectId,
    version: item.version,
    status: item.status as StudyPlanVersionStatus,
    inputSnapshot: parseInputSnapshot(item.inputSnapshot),
    phases: item.phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      goal: phase.goal,
      description: phase.description ?? undefined,
      completionCriteria: phase.completionCriteria ?? undefined,
      order: phase.order,
      knowledgeNodeIds: phase.knowledgeNodeLinks.map((link) => link.knowledgeNodeId)
    })),
    confirmedAt: item.confirmedAt?.toISOString(),
    supersededAt: item.supersededAt?.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function throwVersionConflict(error: unknown): never {
  if (
    error instanceof PlanVersionRepositoryConflictError ||
    isUniqueConstraintError(error)
  ) {
    throw new AppError(
      "INVALID_REQUEST",
      "A draft plan version already exists or the next version number was claimed concurrently.",
      409
    );
  }

  throw error;
}

export const planVersionsService = {
  async list(projectId: string): Promise<{ items: PlanVersionItem[] }> {
    const normalizedProjectId = await ensureOwnedProject(projectId);
    const items = await planVersionsRepository.listByProject(normalizedProjectId);

    return {
      items: items.map(toPlanVersionItem)
    };
  },

  async getCurrent(projectId: string): Promise<PlanVersionItem> {
    const normalizedProjectId = await ensureOwnedProject(projectId);
    const item = await planVersionsRepository.findCurrentForProject(normalizedProjectId);

    if (!item) {
      throw new AppError("INVALID_REQUEST", "Confirmed plan version not found.", 404);
    }

    return toPlanVersionItem(item);
  },

  async getById(projectId: string, versionId: string): Promise<PlanVersionItem> {
    const normalizedProjectId = await ensureOwnedProject(projectId);
    const item = await planVersionsRepository.findByIdForProject(
      normalizeRequiredString(versionId, "versionId"),
      normalizedProjectId
    );

    if (!item) {
      throw new AppError("INVALID_REQUEST", "Plan version not found.", 404);
    }

    return toPlanVersionItem(item);
  },

  async create(projectId: string, input: unknown): Promise<PlanVersionItem> {
    const normalizedProjectId = await ensureOwnedProject(projectId);
    const normalizedInput = normalizeCreateInput(input);
    await ensureActiveKnowledgeNodes(normalizedInput.phases, normalizedProjectId);

    try {
      const item = await planVersionsRepository.createDraft(
        normalizedProjectId,
        JSON.stringify(normalizedInput.inputSnapshot),
        normalizedInput.phases
      );

      return toPlanVersionItem(item);
    } catch (error) {
      return throwVersionConflict(error);
    }
  },

  async update(
    projectId: string,
    versionId: string,
    input: unknown
  ): Promise<PlanVersionItem> {
    const normalizedProjectId = await ensureOwnedProject(projectId);
    const normalizedInput = normalizeUpdateInput(input);
    await ensureActiveKnowledgeNodes(normalizedInput.phases, normalizedProjectId);
    const result = await planVersionsRepository.replaceDraftPhases(
      normalizeRequiredString(versionId, "versionId"),
      normalizedProjectId,
      normalizedInput.phases
    );

    if (result.status === "not_found") {
      throw new AppError("INVALID_REQUEST", "Plan version not found.", 404);
    }

    if (result.status === "not_draft") {
      throw new AppError("INVALID_REQUEST", "Only draft plan versions can be updated.", 409);
    }

    return toPlanVersionItem(result.item);
  },

  async confirm(projectId: string, versionId: string): Promise<PlanVersionItem> {
    const normalizedProjectId = await ensureOwnedProject(projectId);
    const result = await planVersionsRepository.confirm(
      normalizeRequiredString(versionId, "versionId"),
      normalizedProjectId
    );

    switch (result.status) {
      case "success":
      case "already_confirmed":
        return toPlanVersionItem(result.item);
      case "not_found":
        throw new AppError("INVALID_REQUEST", "Plan version not found.", 404);
      case "superseded":
        throw new AppError("INVALID_REQUEST", "Superseded plan versions cannot be confirmed.", 409);
      case "incomplete":
        throw new AppError(
          "INVALID_REQUEST",
          "A plan must contain at least one phase and each phase must contain a knowledge node.",
          409
        );
      case "invalid_knowledge_nodes":
        throw new AppError(
          "INVALID_REQUEST",
          "The plan contains archived or cross-project knowledge nodes.",
          409
        );
    }
  },

  async revise(projectId: string, versionId: string): Promise<PlanVersionItem> {
    const normalizedProjectId = await ensureOwnedProject(projectId);

    try {
      const result = await planVersionsRepository.revise(
        normalizeRequiredString(versionId, "versionId"),
        normalizedProjectId
      );

      switch (result.status) {
        case "success":
          return toPlanVersionItem(result.item);
        case "not_found":
          throw new AppError("INVALID_REQUEST", "Plan version not found.", 404);
        case "not_current":
          throw new AppError(
            "INVALID_REQUEST",
            "Only the current confirmed plan version can be revised.",
            409
          );
        case "draft_exists":
          throw new AppError("INVALID_REQUEST", "A draft plan version already exists.", 409);
        case "invalid_knowledge_nodes":
          throw new AppError(
            "INVALID_REQUEST",
            "The current plan contains archived or cross-project knowledge nodes.",
            409
          );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      return throwVersionConflict(error);
    }
  }
};
