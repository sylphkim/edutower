export type PlanStatus = "draft" | "active" | "completed";
export type PlanTaskType = "read_material" | "practice_quiz" | "review_wrongbook" | "master_skill";
export type PlanTaskStatus = "todo" | "in_progress" | "done";

export interface PlanTask {
  id: string;
  title: string;
  type: PlanTaskType;
  materialId?: string;
  skillId?: string;
  status: PlanTaskStatus;
}

export interface PlanDay {
  day: number;
  title: string;
  tasks: PlanTask[];
}

export interface PlanItem {
  id: string;
  title: string;
  goal?: string;
  deadline?: string | null;
  dailyMinutes?: number | null;
  materialIds: string[];
  skillIds: string[];
  days: PlanDay[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

// 创建时不传 id、状态和时间，由 service 统一补齐。
export interface CreatePlanInput {
  title: string;
  subject?: string;
  goal?: string;
  deadline?: string | null;
  dailyMinutes?: number | null;
  materialIds?: string[];
  skillIds?: string[];
  days?: PlanDay[];
}

// PATCH 只传需要修改的字段。
export interface UpdatePlanInput {
  title?: string;
  goal?: string;
  deadline?: string | null;
  dailyMinutes?: number | null;
  materialIds?: string[];
  skillIds?: string[];
  days?: PlanDay[];
  status?: PlanStatus;
}
