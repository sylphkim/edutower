export type SkillLearningState = "not_started" | "learning" | "mastered";

export interface SkillItem {
  id: string;
  title: string;
  description?: string;
  parentId?: string;
  prerequisites: string[];
  learningState: SkillLearningState;
  isUnlocked: boolean;
  unlockedAt?: string;
  mastery: number;
  order: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDependencyEdge {
  sourceId: string;
  targetId: string;
}

export interface CreateSkillInput {
  title: string;
  description?: string;
  parentId?: string;
  prerequisites?: string[];
  learningState?: SkillLearningState;
  mastery?: number;
  order?: number;
}

export interface UpdateSkillLearningStateInput {
  learningState: SkillLearningState;
}

export interface SkillTreeItem extends SkillItem {
  prerequisiteRisk: boolean;
  riskPrerequisiteIds: string[];
  children: SkillTreeItem[];
}

export interface SkillTreeResponse {
  items: SkillTreeItem[];
  dependencyEdges: SkillDependencyEdge[];
}
