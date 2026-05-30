import type { QuizSession, QuizSubmissionResult } from "../types/edutower";

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

export const mockQuizSubmissionResult: QuizSubmissionResult = {
  sessionId: "quiz-001",
  total: 1,
  correct: 0,
  score: 0,
  wrongQuestionIds: ["q-001"]
};
