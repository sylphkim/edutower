import type { KnowledgePoint } from "../types/edutower";

export const mockKnowledgePoints: KnowledgePoint[] = [
  {
    id: "kp-calculus",
    title: "Calculus Foundations",
    description: "Core concepts for understanding limits, derivatives, and change.",
    prerequisiteIds: [],
    mastery: 0.42
  },
  {
    id: "kp-derivative",
    title: "Derivative",
    description: "Understand derivatives as slopes and instantaneous rates of change.",
    parentId: "kp-calculus",
    prerequisiteIds: [],
    mastery: 0.35
  },
  {
    id: "kp-chain-rule",
    title: "Chain Rule",
    description: "Differentiate composite functions by combining inner and outer rates.",
    parentId: "kp-derivative",
    prerequisiteIds: ["kp-derivative"],
    mastery: 0.18
  }
];
