import {
  knowledgeNodesRepository,
  type KnowledgeNodeWithPrerequisites
} from "../repositories/knowledgeNodes.repository";
import { quizzesRepository, type QuizWithQuestions } from "../repositories/quizzes.repository";
import { wrongbookRepository } from "../repositories/wrongbook.repository";
import type {
  CreateQuizInput,
  QuizDifficulty,
  QuizItem,
  SubmitQuizInput,
  SubmitQuizResult
} from "../types/quiz";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { getDemoProjectId } from "./demoProject.service";
import { getDemoUserId } from "./demoUser.service";
import { quizGenerator } from "./quizGenerator.service";

const VALID_DIFFICULTIES: QuizDifficulty[] = ["pass", "high_score"];
const MAX_QUESTION_COUNT = 20;
const DEFAULT_QUESTION_COUNT = 5;

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
        : undefined
    })),
    createdAt: quiz.createdAt.toISOString()
  };
}

async function resolveQuizTarget(
  input: CreateQuizInput,
  projectId: string
): Promise<{ knowledgeNode: KnowledgeNodeWithPrerequisites; studyTaskId?: string }> {
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

  const knowledgeNode = await knowledgeNodesRepository.findByIdForProject(knowledgeNodeId, projectId);

  if (!knowledgeNode) {
    throw new AppError(
      "INVALID_REQUEST",
      "skillId must reference a skill in the same project.",
      400
    );
  }

  return {
    knowledgeNode,
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
    const questionCount = input.questionCount ?? DEFAULT_QUESTION_COUNT;

    // 优先让 AI 出题；AI 不可用时出题器内部会自动退回 mock（见 quizGenerator.service）。
    const generated = await quizGenerator.generate({
      knowledgeTitle: target.knowledgeNode.title,
      knowledgeDescription: target.knowledgeNode.description ?? undefined,
      difficulty: input.difficulty,
      count: questionCount
    });

    logger.info("quiz.create: 出题完成", {
      source: generated.source,
      knowledgeNodeId: target.knowledgeNode.id,
      count: generated.questions.length
    });

    const quiz = await quizzesRepository.create({
      projectId,
      title: input.title?.trim() || `${target.knowledgeNode.title} 测验`,
      knowledgeNodeId: target.knowledgeNode.id,
      studyTaskId: target.studyTaskId,
      difficulty: input.difficulty,
      questions: generated.questions.map((question, index) => ({
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

    const userId = await getDemoUserId();
    const projectId = await getDemoProjectId();
    const quiz = ensureQuizExists(await quizzesRepository.findByIdForProject(id, projectId));
    const answerMap = new Map(
      input.answers.map((answer) => [answer.questionId, normalizeAnswer(answer.answer)])
    );
    const wrongQuestions = quiz.questions.filter((question) => {
      const submittedAnswer = answerMap.get(question.id) ?? "";

      return submittedAnswer !== normalizeAnswer(question.answer);
    });

    await wrongbookRepository.recordQuizSubmission({
      userId,
      projectId,
      knowledgeNodeId: quiz.knowledgeNodeId,
      questions: quiz.questions.map((question) => {
        const userAnswer =
          input.answers.find((answer) => answer.questionId === question.id)?.answer ?? "";
        const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(question.answer);

        return {
          questionId: question.id,
          questionType: question.type,
          questionPrompt: question.prompt,
          correctAnswer: question.answer,
          explanation: question.explanation ?? undefined,
          userAnswer,
          isCorrect
        };
      })
    });

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
