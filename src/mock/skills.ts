import type { SkillItem } from "../types/skills";

export const mockSkillItems: SkillItem[] = [
  {
    id: "skill-001",
    title: "Calculus Foundations",
    description: "Core concepts for understanding limits, derivatives, and change.",
    prerequisites: [],
    status: "available",
    mastery: 42,
    order: 1,
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z"
  },
  {
    id: "skill-002",
    title: "Derivative",
    description: "Understand derivatives as slopes and instantaneous rates of change.",
    parentId: "skill-001",
    prerequisites: [],
    status: "in_progress",
    mastery: 35,
    order: 1,
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z"
  },
  {
    id: "skill-003",
    title: "Chain Rule",
    description: "Differentiate composite functions by combining inner and outer rates.",
    parentId: "skill-002",
    prerequisites: ["skill-002"],
    status: "locked",
    mastery: 18,
    order: 1,
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z"
  }
];
