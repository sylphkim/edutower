import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import { quizzesRepository, type QuizWithQuestions } from "../repositories/quizzes.repository";
import type {
  CreateQuizInput,
  QuizDifficulty,
  QuizItem,
  QuizQuestion,
  SubmitQuizInput,
  SubmitQuizResult
} from "../types/quiz";
import { AppError } from "../utils/errors";
import { getDemoProjectId } from "./demoProject.service";

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

function ensureQuizExists(item: QuizWithQuestions | null): QuizWithQuestions {
  if (!item) {
    throw new AppError("INVALID_REQUEST", "Quiz item not found.", 404);
  }

  return item;
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

  if (input.skillId !== undefined && typeof input.skillId !== "string") {
    throw new AppError("INVALID_REQUEST", "skillId must be a string.", 400);
  }

  if (input.studyTaskId !== undefined && typeof input.studyTaskId !== "string") {
    throw new AppError("INVALID_REQUEST", "studyTaskId must be a string.", 400);
  }

  if (!input.skillId && !input.studyTaskId) {
    throw new AppError("INVALID_REQUEST", "skillId or studyTaskId is required.", 400);
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

function createMockQuestions(count: number): Omit<QuizQuestion, "id">[] {
  return Array.from({ length: count }, (_, index) => {
    const baseQuestion = MOCK_QUESTION_BANK[index % MOCK_QUESTION_BANK.length];

    return {
      ...baseQuestion,
      options: baseQuestion.options ? [...baseQuestion.options] : undefined
    };
  });
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

function toApiQuiz(quiz: QuizWithQuestions): QuizItem {
  return {
    id: quiz.id,
    title: quiz.title,
    materialId: quiz.studyTask?.materialId ?? undefined,
    skillId: quiz.knowledgeNodeId,
    studyTaskId: quiz.studyTaskId ?? undefined,
    difficulty: quiz.difficulty as QuizDifficulty,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options.length
        ? question.options.map((option) => option.text)
        : undefined,
      answer: question.answer,
      explanation: question.explanation ?? undefined
    })),
    createdAt: quiz.createdAt.toISOString()
  };
}

async function resolveQuizTarget(
  input: CreateQuizInput,
  projectId: string
): Promise<{ knowledgeNodeId: string; studyTaskId?: string }> {
  const studyTask = input.studyTaskId
    ? await quizzesRepository.findStudyTaskForProject(input.studyTaskId, projectId)
    : null;

  if (input.studyTaskId && !studyTask) {
    throw new AppError(
      "INVALID_REQUEST",
      "studyTaskId must reference a task in the same project.",
      400
    );
  }

  if (input.skillId) {
    const skill = await knowledgeNodesRepository.findByIdForProject(input.skillId, projectId);

    if (!skill) {
      throw new AppError(
        "INVALID_REQUEST",
        "skillId must reference a skill in the same project.",
        400
      );
    }
  }

  if (studyTask?.knowledgeNodeId && input.skillId && studyTask.knowledgeNodeId !== input.skillId) {
    throw new AppError(
      "INVALID_REQUEST",
      "skillId must match the study task skill.",
      400
    );
  }

  const knowledgeNodeId = input.skillId ?? studyTask?.knowledgeNodeId;

  if (!knowledgeNodeId) {
    throw new AppError(
      "INVALID_REQUEST",
      "studyTaskId must reference a task with skillId.",
      400
    );
  }

  return {
    knowledgeNodeId,
    studyTaskId: studyTask?.id
  };
}

export const quizService = {
  async list(): Promise<{ items: QuizItem[] }> {
    const projectId = await getDemoProjectId();
    const items = await quizzesRepository.listByProject(projectId);

    return {
      items: items.map(toApiQuiz)
    };
  },

  async getById(id: string): Promise<QuizItem> {
    const projectId = await getDemoProjectId();
    const item = ensureQuizExists(await quizzesRepository.findByIdForProject(id, projectId));

    return toApiQuiz(item);
  },

  async create(input: CreateQuizInput): Promise<QuizItem> {
    ensureValidCreateInput(input);

    const projectId = await getDemoProjectId();
    const target = await resolveQuizTarget(input, projectId);
    const questionCount = input.questionCount ?? 3;
    const questions = createMockQuestions(questionCount);
    const quiz = await quizzesRepository.create({
      projectId,
      title: input.title?.trim() || "Mock Quiz",
      knowledgeNodeId: target.knowledgeNodeId,
      studyTaskId: target.studyTaskId,
      difficulty: input.difficulty,
      questions: questions.map((question, index) => ({
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        order: index
      }))
    });

    return toApiQuiz(quiz);
  },

  async submit(id: string, input: SubmitQuizInput): Promise<SubmitQuizResult> {
    ensureValidSubmitInput(input);

    const projectId = await getDemoProjectId();
    const quiz = ensureQuizExists(await quizzesRepository.findByIdForProject(id, projectId));
    const answerMap = new Map(
      input.answers.map((answer) => [answer.questionId, normalizeAnswer(answer.answer)])
    );
    const wrongQuestions = quiz.questions.filter((question) => {
      const submittedAnswer = answerMap.get(question.id) ?? "";

      return submittedAnswer !== normalizeAnswer(question.answer);
    });

    await Promise.all(
      quiz.questions.map((question) => {
        const userAnswer = input.answers.find((answer) => answer.questionId === question.id)?.answer ?? "";
        const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(question.answer);

        return quizzesRepository.createAttempt(question.id, userAnswer, isCorrect);
      })
    );

    const total = quiz.questions.length;
    const correctCount = total - wrongQuestions.length;
    const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);

    return {
      quizId: quiz.id,
      score,
      total,
      correctCount,
      wrongQuestions: wrongQuestions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options.length
          ? question.options.map((option) => option.text)
          : undefined,
        answer: question.answer,
        explanation: question.explanation ?? undefined
      }))
    };
  },

  async remove(id: string): Promise<QuizItem> {
    const projectId = await getDemoProjectId();
    const currentItem = ensureQuizExists(await quizzesRepository.findByIdForProject(id, projectId));
    await quizzesRepository.deleteById(currentItem.id);

    return toApiQuiz(currentItem);
  }
};
