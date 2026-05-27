import type { StudyPlan } from "../types/edutower";

export const mockStudyPlan: StudyPlan = {
  id: "plan-001",
  title: "7-Day Calculus Warmup",
  totalDays: 7,
  days: [
    {
      day: 1,
      title: "Derivative intuition",
      goal: "Build a visual and verbal understanding of derivatives.",
      tasks: [
        {
          id: "task-001",
          title: "Read derivative overview",
          type: "read",
          estimatedMinutes: 20,
          knowledgePointIds: ["kp-derivative"]
        },
        {
          id: "task-002",
          title: "Practice slope interpretation",
          type: "practice",
          estimatedMinutes: 15,
          knowledgePointIds: ["kp-derivative"]
        }
      ]
    }
  ]
};
