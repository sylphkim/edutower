export type SkillStatus = "locked" | "available" | "in_progress" | "mastered";

export interface SkillItem {
  id: string;
  title: string;
  description?: string;
  parentId?: string;
  prerequisites: string[];
  status: SkillStatus;
  mastery: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// 创建时不传 id 和时间，由 service 统一生成。
export interface CreateSkillInput {
  title: string;
  description?: string;
  parentId?: string;
  prerequisites?: string[];
  status?: SkillStatus;
  mastery?: number;
  order?: number;
}

// PATCH 只传需要修改的字段。
export interface UpdateSkillInput {
  title?: string;
  description?: string;
  parentId?: string | null;
  prerequisites?: string[];
  status?: SkillStatus;
  mastery?: number;
  order?: number;
}

export interface SkillTreeItem extends SkillItem {
  children: SkillTreeItem[];
}
