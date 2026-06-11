import type { QuizDifficulty } from "../types/quiz";
import { logger } from "../utils/logger";
import { llmService } from "./llm.service";

/**
 * 出题器：给定知识点 + 难度 + 题数，优先用 LLM 生成【单项选择题】。
 * 只要 LLM 不可用 / 报错 / 返回无法解析或不合格的内容，就退回内置 mock 题，
 * 保证调用方永远拿得到一组可用的题目——这个函数对外【绝不抛错】。
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
  /** 这组题最终来自哪里：ai = LLM 真出题，mock = 兜底 */
  source: "ai" | "mock";
  questions: GeneratedQuestion[];
}

const MIN_COUNT = 1;
const MAX_COUNT = 20;
const MIN_OPTIONS = 2;
const MAX_EXPLANATION_LENGTH = 120;
const MAX_AI_ATTEMPTS = 2;

function clampCount(count: number): number {
  if (!Number.isFinite(count)) {
    return MIN_COUNT;
  }

  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(count)));
}

export const quizGenerator = {
  async generate(input: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
    const count = clampCount(input.count);

    // LLM 输出不稳定，失败时重试几次再兜底，明显降低退回 mock 的概率。
    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
      try {
        const questions = await generateWithLlm({ ...input, count });

        if (questions.length > 0) {
          return { source: "ai", questions: questions.slice(0, count) };
        }

        logger.warn(`quizGenerator: 第 ${attempt} 次 LLM 未产出可用题目。`);
      } catch (error) {
        logger.warn(`quizGenerator: 第 ${attempt} 次 LLM 出题失败。`, error);
      }
    }

    logger.warn("quizGenerator: LLM 多次失败，改用 mock 兜底。");
    return { source: "mock", questions: buildMockQuestions(input, count) };
  }
};

// ── AI 路径 ────────────────────────────────────────────────

async function generateWithLlm(
  input: GenerateQuestionsInput & { count: number }
): Promise<GeneratedQuestion[]> {
  const result = await llmService.generateText({
    systemPrompt: buildSystemPrompt(input.difficulty),
    userPrompt: buildUserPrompt(input),
    temperature: 0.4,
    maxOutputTokens: Math.min(6000, 800 * input.count + 1200),
    jsonMode: true
  });

  return parseQuestionList(result.text)
    .map((raw) => toGeneratedQuestion(raw))
    .filter((question): question is GeneratedQuestion => question !== null);
}

function buildSystemPrompt(difficulty: QuizDifficulty): string {
  const difficultyLine =
    difficulty === "high_score"
      ? "难度：偏高。考查细节、易错点和综合应用，可以设置有迷惑性的干扰项。"
      : "难度：基础。考查核心概念，题目直接、不绕弯，不要怪题偏题。";

  return [
    "你是一位严谨的出题老师，只出【单项选择题】。",
    difficultyLine,
    "直接输出 JSON 对象本身，不要输出任何思考过程、解题草稿或代码围栏。",
    "explanation 只写结论性理由、一句话、不超过 40 字，不要写推导过程。"
  ].join("\n");
}

function buildUserPrompt(input: GenerateQuestionsInput & { count: number }): string {
  const description = input.knowledgeDescription?.trim()
    ? `知识点说明：${input.knowledgeDescription.trim()}`
    : "知识点说明：（无）";

  return [
    `知识点：${input.knowledgeTitle}`,
    description,
    `请围绕该知识点出 ${input.count} 道单项选择题。`,
    "要求：",
    "- 用简体中文。",
    "- 每题给 3 到 4 个选项，有且只有一个正确答案。",
    "- answer 字段必须与 options 中的某一项【完全一致，一字不差】。",
    "- explanation 用一句话给出结论性理由，不超过 40 字，不要写推导过程。",
    "只输出如下结构的 JSON 对象，不要任何额外文字：",
    '{"questions":[{"prompt":"题干","options":["选项1","选项2","选项3"],"answer":"正确选项原文","explanation":"解析"}]}'
  ].join("\n");
}

/**
 * 解析模型返回，拿到题目数组。
 * JSON 模式下通常整段就是 {"questions":[...]}；这里也兼容直接给数组，
 * 以及偶尔被代码围栏/多余文字包裹的情况。解析失败抛错，由 generate() 兜底。
 */
function parseQuestionList(text: string): unknown[] {
  const parsed = safeJsonParse(text.trim());

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { questions?: unknown }).questions)
  ) {
    return (parsed as { questions: unknown[] }).questions;
  }

  throw new Error("LLM 返回的 JSON 里没有题目数组。");
}

/**
 * 先整体 JSON.parse；失败时再宽容地截取第一个 { 到最后一个 }（应对围栏/多余文字）。
 */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }

    throw new Error("LLM 返回内容不是合法 JSON。");
  }
}

/**
 * 把一条原始记录校验并规整成 GeneratedQuestion；不合格返回 null（丢弃该题）。
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

  // 去重，避免模型给出重复选项
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
 * explanation 兜底清洗：trim、空串归 undefined、过长截断，
 * 防止模型把解题草稿塞进 explanation 里。
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
 * AI 不可用时的兜底题。题目模板化、围绕知识点标题，
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
