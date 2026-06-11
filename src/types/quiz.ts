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

// 取测验作答时返回给前端的题目：故意不含 answer / explanation，
// 防止交卷前就把答案泄露给客户端。判分一律走服务端 /submit。
export type QuizQuestionPublic = Omit<QuizQuestion, "answer" | "explanation">;

export interface QuizItem {
  id: string;
  title: string;
  materialId?: string;
  skillId?: string;
  studyTaskId?: string;
  difficulty: QuizDifficulty;
  questions: QuizQuestionPublic[];
  createdAt: string;
}

// 当前先用请求参数生成 mock quiz，以后可替换成 LLM 调用。
export interface CreateQuizInput {
  title?: string;
  skillId?: string;
  studyTaskId?: string;
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
