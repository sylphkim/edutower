import type { QuizDifficulty } from "../types/quiz";
import { logger } from "../utils/logger";
import { aiEngineService } from "./aiEngine.service";

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
