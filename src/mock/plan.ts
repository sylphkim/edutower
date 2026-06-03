import type { PlanItem } from "../types/plan";

export const mockPlanItems: PlanItem[] = [
  {
    id: "plan-001",
    title: "7-Day Calculus Warmup",
    goal: "Build a visual and verbal understanding of derivatives.",
    materialIds: ["mat-001"],
    skillIds: ["skill-002"],
    days: [
      {
        day: 1,
        title: "Derivative intuition",
        tasks: [
          {
            id: "task-001",
            title: "Read derivative overview",
            type: "read_material",
            materialId: "mat-001",
            status: "todo"
          },
          {
            id: "task-002",
            title: "Practice slope interpretation",
            type: "practice_quiz",
            quizId: "quiz-001",
            status: "todo"
          }
        ]
      }
    ],
    status: "draft",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z"
  }
];
