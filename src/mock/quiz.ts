import type { QuizSession } from "../types/edutower";
import type { QuizItem } from "../types/quiz";

export const mockQuizSession: QuizSession = {
  id: "quiz-001",
  title: "Derivative Basics Check",
  questions: [
    {
      id: "q-001",
      type: "single_choice",
      stem: "What does a derivative measure at a point?",
      options: [
        {
          id: "A",
          text: "Average value"
        },
        {
          id: "B",
          text: "Instantaneous rate of change"
        },
        {
          id: "C",
          text: "Area under a curve"
        }
      ],
      answer: "B",
      explanation: "A derivative captures the instantaneous rate of change at a point.",
      difficulty: "easy",
      knowledgePointId: "kp-derivative"
    }
  ]
};

export const mockQuizItems: QuizItem[] = [
  {
    id: "quiz-001",
    title: "Derivative Basics Check",
    materialId: "mat-001",
    difficulty: "pass",
    questions: [
      {
        id: "q-001",
        type: "single_choice",
        prompt: "What does a derivative measure at a point?",
        options: ["Average value", "Instantaneous rate of change", "Area under a curve"],
        answer: "Instantaneous rate of change",
        explanation: "A derivative captures the instantaneous rate of change at a point."
      }
    ],
    createdAt: "2026-05-27T00:00:00.000Z"
  }
];
