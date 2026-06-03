import { mockQuizItems } from "../mock/quiz";
import type {
  CreateQuizInput,
  QuizDifficulty,
  QuizItem,
  QuizQuestion,
  SubmitQuizInput,
  SubmitQuizResult
} from "../types/quiz";
import { AppError } from "../utils/errors";

const VALID_DIFFICULTIES: QuizDifficulty[] = ["pass", "high_score"];
const MAX_QUESTION_COUNT = 20;

const MOCK_QUESTION_BANK: Omit<QuizQuestion, "id">[] = [
  {
    type: "single_choice",
    prompt: "What does a derivative measure at a point?",
    options: ["Average value", "Instantaneous rate of change", "Area under a curve"],
    answer: "Instantaneous rate of change",
    explanation: "A derivative captures the instantaneous rate of change at a point."
  },
  {
    type: "single_choice",
    prompt: "Which material type is usually best for lecture slides?",
    options: ["slides", "photo", "note"],
    answer: "slides",
    explanation: "Slides are commonly used to organize lecture content."
  },
  {
    type: "short_answer",
    prompt: "Name one reason to review wrong questions.",
    answer: "identify weak points",
    explanation: "Review helps find weak points and improve later practice."
  },
  {
    type: "single_choice",
    prompt: "What should a study outline usually contain?",
    options: ["Random guesses", "Main topics and structure", "Only final answers"],
    answer: "Main topics and structure",
    explanation: "An outline shows the structure and main topics of the material."
  }
];

// 先用内存数组保存 quiz 记录，以后可以替换成数据库查询。
const quizItems: QuizItem[] = mockQuizItems.map((item) => ({
  ...item,
  questions: item.questions.map((question) => ({ ...question }))
}));
let nextQuizNumber = quizItems.length + 1;

function createQuizId(): string {
  const id = `quiz-${String(nextQuizNumber).padStart(3, "0")}`;
  nextQuizNumber += 1;
  return id;
}

// 找不到 id 时直接抛错，避免调用方静默失败。
function findIndexById(id: string): number {
  const index = quizItems.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new AppError("INVALID_REQUEST", "Quiz item not found.", 404);
  }

  return index;
}

function ensureValidCreateInput(input: CreateQuizInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!VALID_DIFFICULTIES.includes(input.difficulty)) {
    throw new AppError(
      "INVALID_REQUEST",
      `difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}.`,
      400
    );
  }

  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim())) {
    throw new AppError("INVALID_REQUEST", "title must be a non-empty string.", 400);
  }

  if (input.materialId !== undefined && typeof input.materialId !== "string") {
    throw new AppError("INVALID_REQUEST", "materialId must be a string.", 400);
  }

  if (input.skillId !== undefined && typeof input.skillId !== "string") {
    throw new AppError("INVALID_REQUEST", "skillId must be a string.", 400);
  }

  if (
    input.questionCount !== undefined &&
    (!Number.isInteger(input.questionCount) ||
      input.questionCount < 1 ||
      input.questionCount > MAX_QUESTION_COUNT)
  ) {
    throw new AppError(
      "INVALID_REQUEST",
      `questionCount must be an integer between 1 and ${MAX_QUESTION_COUNT}.`,
      400
    );
  }
}

function ensureValidSubmitInput(input: SubmitQuizInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("INVALID_REQUEST", "Request body is required.", 400);
  }

  if (!Array.isArray(input.answers)) {
    throw new AppError("INVALID_REQUEST", "answers must be an array.", 400);
  }

  for (const answer of input.answers) {
    if (
      !answer ||
      typeof answer !== "object" ||
      typeof answer.questionId !== "string" ||
      typeof answer.answer !== "string"
    ) {
      throw new AppError(
        "INVALID_REQUEST",
        "Each answer must include questionId and answer strings.",
        400
      );
    }
  }
}

function createMockQuestions(count: number): QuizQuestion[] {
  return Array.from({ length: count }, (_, index) => {
    const baseQuestion = MOCK_QUESTION_BANK[index % MOCK_QUESTION_BANK.length];

    return {
      ...baseQuestion,
      id: `q-${String(index + 1).padStart(3, "0")}`,
      options: baseQuestion.options ? [...baseQuestion.options] : undefined
    };
  });
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export const quizService = {
  list(): { items: QuizItem[] } {
    return {
      items: quizItems
    };
  },

  getById(id: string): QuizItem {
    return quizItems[findIndexById(id)];
  },

  create(input: CreateQuizInput): QuizItem {
    ensureValidCreateInput(input);

    const questionCount = input.questionCount ?? 3;
    const quiz: QuizItem = {
      id: createQuizId(),
      title: input.title?.trim() || "Mock Quiz",
      materialId: input.materialId,
      skillId: input.skillId,
      difficulty: input.difficulty,
      questions: createMockQuestions(questionCount),
      createdAt: new Date().toISOString()
    };

    quizItems.push(quiz);
    return quiz;
  },

  submit(id: string, input: SubmitQuizInput): SubmitQuizResult {
    ensureValidSubmitInput(input);

    const quiz = quizItems[findIndexById(id)];
    const answerMap = new Map(
      input.answers.map((answer) => [answer.questionId, normalizeAnswer(answer.answer)])
    );
    const wrongQuestions = quiz.questions.filter((question) => {
      const submittedAnswer = answerMap.get(question.id);

      return submittedAnswer !== normalizeAnswer(question.answer);
    });
    const total = quiz.questions.length;
    const correctCount = total - wrongQuestions.length;
    const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);

    return {
      quizId: quiz.id,
      score,
      total,
      correctCount,
      wrongQuestions
    };
  },

  remove(id: string): QuizItem {
    const index = findIndexById(id);
    const [removedItem] = quizItems.splice(index, 1);

    return removedItem;
  }
};
