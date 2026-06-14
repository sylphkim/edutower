export type AgentStepStatus = "done" | "current" | "pending" | "info";

export interface AgentStep {
  label: string;
  status: AgentStepStatus;
}

export interface AgentStatusPayload {
  activeLabel: string;
  steps: AgentStep[];
}

export interface ReviewProgressStats {
  knowledgePoints: number;
  practiceQuestions: number;
  errorCorrections: number;
}

export interface ReviewProgressPayload {
  percent: number;
  subject: string;
  topic: string;
  stats: ReviewProgressStats;
}

export interface AgentPanelPayload {
  agent: AgentStatusPayload;
  progress: ReviewProgressPayload;
  generatedAt: string;
}
