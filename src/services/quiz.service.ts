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
import { getDemoProjectId, getDemoUserId } from "./demo.service";
import { aiEngineService } from "./aiEngine.service";

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

// —— 出题器（原 quizGenerator.service，仅 quiz.service 使用，合并进来）——

/**
 * 出题器：给定知识点 + 难度 + 题数，优先经 FastAPI AI Engine 出【单项选择题】。
 * 按架构要求 Express 不直接调 LLM（前端 → Express → FastAPI → LLM），出题统一走
 * aiEngineService.generateQuiz()。FastAPI 不可用 / 返回不合格时，退回内置 mock 题。
 * 这个函数对外【绝不抛错】，调用方永远拿得到一组可用的单选题。
 */

export interface GenerateQuestionsInput {
  knowledgeTitle: string;
  knowledgeDescription?: string;
  difficulty: QuizDifficulty;
  count: number;
}

// 结构与 types/quiz.ts 的 QuizQuestion（去掉 id）兼容，方便上层直接落库。
export interface GeneratedQuestion {
  type: "single_choice";
  prompt: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface GenerateQuestionsResult {
  /** 这组题最终来自哪里：ai = FastAPI 出题，mock = 兜底 */
  source: "ai" | "mock";
  questions: GeneratedQuestion[];
}

const MIN_COUNT = 1;
const MAX_COUNT = 20;
const MIN_OPTIONS = 2;
const MAX_EXPLANATION_LENGTH = 120;

function clampCount(count: number): number {
  if (!Number.isFinite(count)) {
    return MIN_COUNT;
  }

  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(count)));
}

export const quizGenerator = {
  async generate(input: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
    const count = clampCount(input.count);

    try {
      const rawQuestions = await aiEngineService.generateQuiz({
        knowledgeTitle: input.knowledgeTitle,
        knowledgeDescription: input.knowledgeDescription,
        difficulty: input.difficulty,
        count
      });

      const questions = rawQuestions
        .map((raw) => toGeneratedQuestion(raw))
        .filter((question): question is GeneratedQuestion => question !== null);

      if (questions.length > 0) {
        return { source: "ai", questions: questions.slice(0, count) };
      }

      logger.warn("quizGenerator: AI Engine 未产出可用题目，改用 mock 兜底。");
    } catch (error) {
      logger.warn("quizGenerator: AI Engine 出题失败，改用 mock 兜底。", error);
    }

    return { source: "mock", questions: buildMockQuestions(input, count) };
  }
};

// ── 校验 / 规整 FastAPI 返回的题目 ─────────────────────────────

/**
 * 把一条原始记录校验并规整成 GeneratedQuestion；不合格返回 null（丢弃该题）。
 * 不管题来自 FastAPI 哪种实现，这里都做一层防御：答案必须对齐到某个选项、
 * 选项去重、解析过长截断、题型强制单选。
 */
function toGeneratedQuestion(raw: unknown): GeneratedQuestion | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const options = Array.isArray(record.options)
    ? record.options
        .filter((option): option is string => typeof option === "string")
        .map((option) => option.trim())
        .filter(Boolean)
    : [];
  const rawAnswer = typeof record.answer === "string" ? record.answer.trim() : "";
  const explanation = normalizeExplanation(record.explanation);

  // 去重，避免重复选项
  const uniqueOptions = Array.from(new Set(options));

  if (!prompt || uniqueOptions.length < MIN_OPTIONS || !rawAnswer) {
    return null;
  }

  const answer = resolveAnswer(rawAnswer, uniqueOptions);
  if (!answer) {
    return null;
  }

  return {
    type: "single_choice",
    prompt,
    options: uniqueOptions,
    answer,
    explanation
  };
}

/**
 * explanation 兜底清洗：trim、空串归 undefined、过长截断，防止把解题草稿塞进来。
 */
function normalizeExplanation(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > MAX_EXPLANATION_LENGTH
    ? `${trimmed.slice(0, MAX_EXPLANATION_LENGTH)}…`
    : trimmed;
}

/**
 * 把正确答案对齐到某个选项：
 * 1) 与某选项完全相同（忽略大小写/首尾空白）→ 用该选项原文；
 * 2) 形如 "A"/"B" 的字母 → 映射到对应序号的选项；
 * 否则视为无法对齐，返回 null。
 */
function resolveAnswer(answer: string, options: string[]): string | null {
  const exact = options.find((option) => option.toLowerCase() === answer.toLowerCase());
  if (exact) {
    return exact;
  }

  const letter = answer.toUpperCase();
  if (/^[A-Z]$/.test(letter)) {
    const index = letter.charCodeAt(0) - 65;
    if (index >= 0 && index < options.length) {
      return options[index];
    }
  }

  return null;
}

// ── 兜底路径：内置 mock 题（全单选） ──────────────────────────

/**
 * FastAPI 出题不可用时的兜底题。题目模板化、围绕知识点标题，
 * explanation 里明确标注是兜底题，方便和真·AI 题区分。
 */
function buildMockQuestions(input: GenerateQuestionsInput, count: number): GeneratedQuestion[] {
  const title = input.knowledgeTitle.trim() || "该知识点";

  const templates: Array<Omit<GeneratedQuestion, "type">> = [
    {
      prompt: `关于"${title}"，下列说法正确的是？`,
      options: [
        `${title} 的核心概念应当被正确理解`,
        `${title} 可以随意套用，无需理解`,
        `${title} 与本主题无关`
      ],
      answer: `${title} 的核心概念应当被正确理解`,
      explanation: "兜底题（AI 暂不可用）：选最符合学习目标的描述。"
    },
    {
      prompt: `学习"${title}"时，下面哪种做法更合理？`,
      options: ["先理解定义，再结合例子练习", "直接背答案，不看过程", "跳过这个知识点"],
      answer: "先理解定义，再结合例子练习",
      explanation: "兜底题（AI 暂不可用）：理解加练习是更稳妥的学法。"
    },
    {
      prompt: `下列哪一项最能体现对"${title}"的掌握？`,
      options: ["能用自己的话解释并能举例应用", "只记得名字", "完全没有印象"],
      answer: "能用自己的话解释并能举例应用",
      explanation: "兜底题（AI 暂不可用）：能解释并应用才算真正掌握。"
    }
  ];

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];

    return {
      type: "single_choice",
      ...template,
      options: [...template.options]
    };
  });
}
