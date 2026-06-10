export type StudyPlanVersionStatus = "draft" | "confirmed" | "superseded";

export interface PlanPhaseInput {
  title: string;
  goal: string;
  description?: string;
  completionCriteria?: string;
  knowledgeNodeIds: string[];
}

export interface CreatePlanVersionInput {
  inputSnapshot?: Record<string, unknown>;
  phases?: PlanPhaseInput[];
}

export interface UpdatePlanVersionInput {
  phases: PlanPhaseInput[];
}

export interface PlanPhaseItem {
  id: string;
  title: string;
  goal: string;
  description?: string;
  completionCriteria?: string;
  order: number;
  knowledgeNodeIds: string[];
}

export interface PlanVersionItem {
  id: string;
  projectId: string;
  version: number;
  status: StudyPlanVersionStatus;
  inputSnapshot: Record<string, unknown>;
  phases: PlanPhaseItem[];
  confirmedAt?: string;
  supersededAt?: string;
  createdAt: string;
  updatedAt: string;
}
