import type { MemoryItem } from "../types/memory";

export const mockMemoryItems: MemoryItem[] = [
  {
    id: "mem-001",
    type: "weakness",
    title: "Chain rule needs review",
    content: "The learner often misses the inner derivative when applying the chain rule.",
    relatedMaterialIds: ["mat-001"],
    relatedSkillIds: ["skill-003"],
    relatedQuizIds: ["quiz-001"],
    relatedWrongbookIds: ["wrong-001"],
    importance: "high",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z"
  },
  {
    id: "mem-002",
    type: "preference",
    title: "Prefers step-by-step explanations",
    content: "Short explanations with numbered steps are easier for the learner to follow.",
    relatedMaterialIds: [],
    relatedSkillIds: [],
    relatedQuizIds: [],
    relatedWrongbookIds: [],
    importance: "medium",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z"
  }
];
