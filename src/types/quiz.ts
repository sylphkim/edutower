export type QuizDifficulty = "pass" | "high_score";
export type QuizQuestionType = "single_choice" | "short_answer";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  explanation?: string;
}

export interface QuizItem {
  id: string;
  title: string;
  materialId?: string;
  skillId?: string;
  difficulty: QuizDifficulty;
  questions: QuizQuestion[];
  createdAt: string;
}

// 当前先用请求参数生成 mock quiz，以后可替换成 LLM 调用。
export interface CreateQuizInput {
  title?: string;
  materialId?: string;
  skillId?: string;
  difficulty: QuizDifficulty;
  questionCount?: number;
}

export interface SubmitQuizInput {
  answers: {
    questionId: string;
    answer: string;
  }[];
}

export interface SubmitQuizResult {
  quizId: string;
  score: number;
  total: number;
  correctCount: number;
  wrongQuestions: QuizQuestion[];
}
