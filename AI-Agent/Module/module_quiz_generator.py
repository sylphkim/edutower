import json
import logging
import re
from typing import Any

from Module import module_llm

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 3
_MIN_OPTIONS = 2

_DIFFICULTY_HINT = {
    "pass": "难度：基础巩固，侧重概念理解与常见考点，题目应清晰直接。",
    "high_score": "难度：高分强化，可包含综合应用、易错辨析与多步推理。",
}


def generate_quiz(
    knowledge_title: str,
    knowledge_description: str | None,
    difficulty: str,
    count: int,
) -> list[dict[str, Any]]:
    """调用 LLM 生成单选题；JSON 解析或校验失败时自动重试。"""
    title = (knowledge_title or "").strip() or "该知识点"
    description = (knowledge_description or "").strip()
    difficulty_key = difficulty if difficulty in _DIFFICULTY_HINT else "pass"
    question_count = max(1, min(20, int(count)))

    last_error: str | None = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            raw = _call_llm_json(title, description, difficulty_key, question_count)
            questions = _parse_questions(raw, question_count)
            if questions:
                return questions
            last_error = "模型返回的题目未通过校验"
        except Exception as exc:
            last_error = str(exc)
            logger.warning(
                "generate_quiz attempt %d/%d failed: %s",
                attempt,
                _MAX_ATTEMPTS,
                exc,
            )

    raise RuntimeError(last_error or "出题失败")


def _call_llm_json(
    title: str,
    description: str,
    difficulty: str,
    count: int,
) -> str:
    system_prompt = (
        "你是 EduTower 学习平台的出题助手。"
        "请生成以下类型的题目，输出合法 JSON，不要输出 Markdown 代码块或任何额外说明。"
        "JSON 顶层只有一个字段 questions，值为数组；数组长度必须等于要求的题数。\n"
        "题目类型包括：\n"
        "1. 单选题（type: single_choice）：prompt（题干）、options（3-4 个互斥选项的字符串数组）、"
        "answer（必须与 options 中某一项文字完全一致）、explanation（一句话解析）。\n"
        "2. 简答题（type: short_answer）：prompt（题干）、answer（参考答案）、"
        "explanation（解析），不需要 options 字段。\n"
        "请混搭两种题型。题干与选项使用简体中文。"
    )

    user_prompt = (
        f"知识点：{title}\n"
        f"知识点说明：{description or '（无补充说明）'}\n"
        f"{_DIFFICULTY_HINT[difficulty]}\n"
        f"请生成 {count} 道单项选择题。\n"
        '只返回 JSON，格式示例：'
        '{"questions":[{"prompt":"...","options":["A","B","C"],"answer":"B","explanation":"..."}]}'
    )

    client = module_llm._build_client()
    response = client.chat.completions.create(
        model=module_llm._config.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=module_llm._config.max_tokens,
        temperature=0.4,
        top_p=module_llm._config.top_p,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content or not str(content).strip():
        raise ValueError("LLM 返回空内容")
    return str(content).strip()


def _parse_questions(raw: str, expected_count: int) -> list[dict[str, Any]]:
    payload = _load_json(raw)
    if not isinstance(payload, dict):
        raise ValueError("JSON 顶层必须是对象")

    questions_raw = payload.get("questions")
    if not isinstance(questions_raw, list) or not questions_raw:
        raise ValueError("questions 必须是非空数组")

    validated: list[dict[str, Any]] = []
    for item in questions_raw:
        normalized = _normalize_question(item)
        if normalized:
            validated.append(normalized)

    if not validated:
        raise ValueError("没有通过校验的题目")

    return validated[:expected_count]


def _load_json(raw: str) -> Any:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    return json.loads(text)


def _normalize_question(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None

    prompt = str(item.get("prompt", "")).strip()
    answer_raw = str(item.get("answer", "")).strip()
    explanation_raw = str(item.get("explanation", "")).strip()
    raw_type = str(item.get("type", "single_choice")).strip().lower()

    # ── short_answer: no options needed ──
    if raw_type == "short_answer":
        if not prompt or not answer_raw:
            return None
        return {
            "type": "short_answer",
            "prompt": prompt,
            "answer": answer_raw,
            "explanation": explanation_raw or "请结合知识点理解参考答案。",
        }

    # ── single_choice (default) ──
    options_raw = item.get("options")
    if not isinstance(options_raw, list):
        return None

    options = []
    for option in options_raw:
        if isinstance(option, str):
            text = option.strip()
            if text and text not in options:
                options.append(text)

    if not prompt or len(options) < _MIN_OPTIONS or not answer_raw:
        return None

    answer = _resolve_answer(answer_raw, options)
    if not answer:
        return None

    return {
        "type": "single_choice",
        "prompt": prompt,
        "options": options,
        "answer": answer,
        "explanation": explanation_raw or "请参考正确选项理解本题要点。",
    }


def _resolve_answer(answer: str, options: list[str]) -> str | None:
    for option in options:
        if option.lower() == answer.lower():
            return option

    letter = answer.upper()
    if len(letter) == 1 and "A" <= letter <= "Z":
        index = ord(letter) - ord("A")
        if 0 <= index < len(options):
            return options[index]

    return None
