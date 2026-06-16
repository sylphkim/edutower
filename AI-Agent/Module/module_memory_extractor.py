"""Extract durable learning memories from a chat turn."""

import json
import logging
import re
from typing import Any

from Module import module_llm

logger = logging.getLogger(__name__)

_VALID_TYPES = {"weakness", "daily_summary", "progress", "preference", "note"}
_VALID_IMPORTANCE = {"low", "medium", "high"}


def extract_memory_updates(
    user_message: str,
    assistant_reply: str,
    context: dict | None = None,
) -> list[dict[str, Any]]:
    """Return 0–3 memory items worth persisting after a chat turn."""
    user_message = (user_message or "").strip()
    assistant_reply = (assistant_reply or "").strip()
    if not user_message or not assistant_reply:
        return []

    existing_titles = _existing_titles(context)
    try:
        raw = _call_llm(user_message, assistant_reply, existing_titles)
        return _parse_updates(raw, existing_titles)
    except Exception as exc:
        logger.warning("memory extraction failed: %s", exc)
        return []


def append_memory_block(reply: str, updates: list[dict[str, Any]]) -> str:
    """Append Express-parseable memory block; hidden from user after Express strips it."""
    if not updates:
        return reply
    payload = json.dumps(updates, ensure_ascii=False)
    return f"{reply.rstrip()}\n\n---memory_updates\n{payload}\n---"


def _existing_titles(context: dict | None) -> list[str]:
    if not context or not isinstance(context, dict):
        return []
    memories = context.get("memories") or []
    titles: list[str] = []
    for item in memories:
        if isinstance(item, dict):
            title = str(item.get("title") or "").strip()
            if title:
                titles.append(title)
    return titles


def _call_llm(user_message: str, assistant_reply: str, existing_titles: list[str]) -> str:
    known = "、".join(existing_titles[:20]) if existing_titles else "（无）"

    system_prompt = (
        "你是 EduTower 学习记忆提取器。"
        "根据本轮对话，判断是否值得写入长期记忆。"
        "只输出合法 JSON，不要 Markdown。"
        'JSON 格式：{"updates":[...]}，updates 为数组，长度 0–3。'
        "每项字段：type（weakness|daily_summary|progress|preference|note）、"
        "title（简短标题，勿与已有记忆重复）、"
        "content（1–3 句具体描述）、"
        "importance（low|medium|high，默认 medium）。"
        "仅记录对学习有帮助的薄弱点、进展、偏好或重要笔记；"
        "闲聊、一次性问答、已有记忆重复内容不要写入。"
    )

    user_prompt = (
        f"已有记忆标题：{known}\n\n"
        f"学生：{user_message}\n\n"
        f"助教：{assistant_reply}\n\n"
        "若无值得保存的内容，返回 {\"updates\":[]}。"
    )

    client = module_llm._build_client()
    response = client.chat.completions.create(
        model=module_llm._config.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=min(module_llm._config.max_tokens, 1024),
        temperature=0.2,
        top_p=module_llm._config.top_p,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content or not str(content).strip():
        raise ValueError("LLM 返回空内容")
    return str(content).strip()


def _parse_updates(raw: str, existing_titles: list[str]) -> list[dict[str, Any]]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    payload = json.loads(text)
    items_raw = payload.get("updates") if isinstance(payload, dict) else payload
    if not isinstance(items_raw, list):
        return []

    known = {t.lower() for t in existing_titles}
    validated: list[dict[str, Any]] = []

    for item in items_raw[:3]:
        if not isinstance(item, dict):
            continue
        mem_type = str(item.get("type") or "").strip()
        title = str(item.get("title") or "").strip()
        content = str(item.get("content") or "").strip()
        importance = str(item.get("importance") or "medium").strip()

        if mem_type not in _VALID_TYPES:
            continue
        if not title or not content:
            continue
        if title.lower() in known:
            continue
        if importance not in _VALID_IMPORTANCE:
            importance = "medium"

        validated.append(
            {
                "type": mem_type,
                "title": title,
                "content": content,
                "importance": importance,
            }
        )
        known.add(title.lower())

    return validated
