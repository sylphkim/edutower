"""Generate daily study summaries via LLM."""

import logging
from typing import Any

from Module import module_llm

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 2


def generate_summary(
    project: dict[str, Any],
    date: str,
    study_data: str,
    conversation_excerpts: str | None = None,
) -> str:
    """Return a concise daily summary in Chinese."""
    title = str((project or {}).get("title") or "学习项目").strip()
    subject = str((project or {}).get("subject") or "").strip()
    goal = str((project or {}).get("goal") or "").strip()
    study_data = (study_data or "").strip()
    excerpts = (conversation_excerpts or "").strip()
    local_date = (date or "").strip()

    if not study_data and not excerpts:
        raise ValueError("study_data and conversation_excerpts are both empty")

    last_error: str | None = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            summary = _call_llm(title, subject, goal, local_date, study_data, excerpts)
            if summary:
                return summary
            last_error = "模型返回空总结"
        except Exception as exc:
            last_error = str(exc)
            logger.warning(
                "generate_summary attempt %d/%d failed: %s",
                attempt,
                _MAX_ATTEMPTS,
                exc,
            )

    raise RuntimeError(last_error or "总结生成失败")


def _call_llm(
    title: str,
    subject: str,
    goal: str,
    local_date: str,
    study_data: str,
    excerpts: str,
) -> str:
    system_prompt = (
        "你是 EduTower 学习平台的每日学习总结助手。"
        "根据提供的客观学习数据，写一段简洁、鼓励性的中文日总结（150–350 字）。"
        "结构建议：今日完成情况 → 掌握/薄弱信号 → 明日建议。"
        "只基于给定数据，不要编造未出现的测验分数或任务。"
        "直接输出总结正文，不要标题、不要 Markdown、不要 JSON。"
    )

    parts = [
        f"项目：{title}",
        f"学科：{subject or '未指定'}",
        f"学习目标：{goal or '未填写'}",
        f"日期：{local_date or '今日'}",
        "",
        "【今日学习数据】",
        study_data or "（无结构化数据）",
    ]

    if excerpts:
        parts.extend(["", "【今日对话摘录】", excerpts])

    user_prompt = "\n".join(parts)

    client = module_llm._build_client()
    response = client.chat.completions.create(
        model=module_llm._config.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=min(module_llm._config.max_tokens, 2048),
        temperature=0.5,
        top_p=module_llm._config.top_p,
    )

    content = response.choices[0].message.content
    if not content or not str(content).strip():
        raise ValueError("LLM 返回空内容")
    return str(content).strip()
