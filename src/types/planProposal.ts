import type { PlanVersionItem } from "./planVersion";

export interface PlanProposalMetadata {
  provider?: string;
  model?: string;
  generatedAt?: string;
}

export interface PlanProposalNodeInput {
  key: string;
  title: string;
  description?: string;
  parentKey?: string;
}

export interface PlanProposalPrerequisiteEdgeInput {
  prerequisiteKey: string;
  nodeKey: string;
}

export interface PlanProposalPhaseInput {
  title: string;
  goal: string;
  description?: string;
  completionCriteria?: string;
  nodeKeys: string[];
}

export interface NormalizedPlanProposal {
  proposalId: string;
  metadata?: PlanProposalMetadata;
  nodes: PlanProposalNodeInput[];
  prerequisiteEdges: PlanProposalPrerequisiteEdgeInput[];
  phases: PlanProposalPhaseInput[];
}

export interface AppliedProposalKnowledgeNode {
  key: string;
  id: string;
}

export interface ApplyPlanProposalResult {
  planVersion: PlanVersionItem;
  knowledgeNodes: AppliedProposalKnowledgeNode[];
  idempotentReplay: boolean;
}
