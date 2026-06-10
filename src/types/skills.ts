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

export interface CreateSkillInput {
  title: string;
  description?: string;
  parentId?: string;
  prerequisites?: string[];
  learningState?: SkillLearningState;
  mastery?: number;
  order?: number;
}

export interface UpdateSkillInput {
  title?: string;
  description?: string;
  parentId?: string | null;
  prerequisites?: string[];
  learningState?: SkillLearningState;
  mastery?: number;
  order?: number;
}

export interface SkillTreeItem extends SkillItem {
  children: SkillTreeItem[];
}
