import type { WrongbookItem } from "../types/edutower";
import { mockQuizSession } from "./quiz";

export const mockWrongbookItems: WrongbookItem[] = [
  {
    id: "wrong-001",
    question: mockQuizSession.questions[0],
    wrongAnswer: "A",
    reviewCount: 0
  }
];
