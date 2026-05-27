import { mockQuizSession, mockQuizSubmissionResult } from "../mock/quiz";
import type { QuizSession, QuizSubmissionResult, StubPayload } from "../types/edutower";
import { createStubPayload } from "./stub.service";

export const quizService = {
  generateQuiz(): StubPayload<{ quiz: QuizSession }> {
    return createStubPayload("quiz.generate", "Quiz generation is scaffolded only.", {
      quiz: mockQuizSession
    });
  },

  submitQuiz(): StubPayload<{ submission: QuizSubmissionResult }> {
    return createStubPayload("quiz.submit", "Quiz submission grading is scaffolded only.", {
      submission: mockQuizSubmissionResult
    });
  }
};
