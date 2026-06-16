"""Design a full learning plan (skills + phases) from goal, deadline, and daily budget."""

import json
import logging
import re
from datetime import date, datetime
from typing import Any

from Module import module_llm

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 2


def design_learning_plan(
    goal: str,
    subject: str,
    deadline: str | None,
    daily_minutes: int | None,
    target_score: str | None,
    existing_skills: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return a plan proposal JSON with nodes, edges, and deadline-aware phases."""
    existing_skills = existing_skills or []
    days_remaining = _days_until(deadline)
    minutes = daily_minutes if daily_minutes and daily_minutes > 0 else 60

    last_error: str | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            raw = _call_llm_json(
                goal=goal,
                subject=subject,
                target_score=target_score,
                days_remaining=days_remaining,
                daily_minutes=minutes,
                existing_skills=existing_skills,
            )
            proposal = _parse_designed_proposal(raw)
            if proposal:
                return proposal
            last_error = "模型返回的计划未通过校验"
        except Exception as exc:
            last_error = str(exc)
            logger.warning(
                "design_learning_plan attempt %d/%d failed: %s",
                attempt,
                _MAX_ATTEMPTS,
                exc,
            )

    raise RuntimeError(last_error or "学习计划设计失败")


def _days_until(deadline: str | None) -> int | None:
    if not deadline or not str(deadline).strip():
        return None
    text = str(deadline).strip()[:10]
    try:
        target = date.fromisoformat(text)
    except ValueError:
        return None
    delta = (target - date.today()).days
    return max(delta, 1)


def _call_llm_json(
    goal: str,
    subject: str,
    target_score: str | None,
    days_remaining: int | None,
    daily_minutes: int,
    existing_skills: list[dict[str, Any]],
) -> str:
    timeline = (
        f"距离截止日期还有 {days_remaining} 天，每天可用 {daily_minutes} 分钟。"
        if days_remaining
        else f"未设置明确截止日期，按每天 {daily_minutes} 分钟合理拆分阶段。"
    )

    skill_lines = []
    for skill in existing_skills[:40]:
        line = f"- title={skill.get('title')}"
        if skill.get("description"):
            line += f" desc={skill['description']}"
        skill_lines.append(line)

    reuse_hint = (
        "已有技能节点（仅当与当前学习目标同一学科/主题时才复用；"
        "无关的旧节点请忽略并新建节点；key 用 node_<英文缩写>）：\n"
        + "\n".join(skill_lines)
        if skill_lines
        else "当前没有已有技能，请根据学习目标从零拆解 8–15 个知识点。"
    )

    system_prompt = (
        "你是 EduTower 学习规划 Agent。"
        "根据学习目标、截止日期与每日学习时长，设计完整学习路径：知识点列表 + 先修关系 + 分阶段计划。"
        "必须输出合法 JSON，不要 Markdown。"
        "JSON 字段：proposalId、metadata（provider/model/generatedAt）、"
        "nodes（key/title，可选 description/parentKey）、"
        "prerequisiteEdges（prerequisiteKey/nodeKey）、"
        "phases（title/goal，可选 description/completionCriteria/nodeKeys）。"
        "nodes 的 key 格式 node_<简短英文>，如 node_limit、node_derivative。"
        "phases 按时间线从早到晚排列，每阶段 nodeKeys 引用 nodes 中的 key；"
        "阶段数量与每日时长、剩余天数匹配（通常 2–5 个阶段）。"
        "prerequisiteEdges 必须沿学习路径形成连通链（至少覆盖全部 nodes 的顺序先修），"
        "禁止出现与目标无关的孤立节点簇。"
        "每个 phase 的 goal 要具体，completionCriteria 可写「完成本阶段全部知识点练习」。"
        "严禁把与学习目标无关的已有节点（如二次函数 demo、线代）混入高数/微积分计划。"
    )

    user_prompt = (
        f"学科/项目：{subject or '通用'}\n"
        f"学习目标：{goal or '未填写'}\n"
        f"目标分档：{target_score or '未设置'}\n"
        f"{timeline}\n\n"
        f"{reuse_hint}\n\n"
        "请输出完整 JSON 提案。"
    )

    client = module_llm._build_client()
    response = client.chat.completions.create(
        model=module_llm._config.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=module_llm._config.max_tokens,
        temperature=0.5,
        top_p=module_llm._config.top_p,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content or not str(content).strip():
        raise ValueError("LLM 返回空内容")
    return str(content).strip()


def _parse_designed_proposal(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    payload = json.loads(text)
    if not isinstance(payload, dict):
        return None

    nodes_raw = payload.get("nodes")
    phases_raw = payload.get("phases")
    if not isinstance(nodes_raw, list) or not nodes_raw:
        return None
    if not isinstance(phases_raw, list) or not phases_raw:
        return None

    nodes: list[dict[str, Any]] = []
    node_keys: set[str] = set()

    for item in nodes_raw:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        title = str(item.get("title") or "").strip()
        if not key or not title:
            continue
        node: dict[str, Any] = {"key": key, "title": title}
        description = str(item.get("description") or "").strip()
        if description:
            node["description"] = description
        parent_key = str(item.get("parentKey") or "").strip()
        if parent_key:
            node["parentKey"] = parent_key
        nodes.append(node)
        node_keys.add(key)

    if not nodes:
        return None

    edges: list[dict[str, str]] = []
    edges_raw = payload.get("prerequisiteEdges")
    if isinstance(edges_raw, list):
        for edge in edges_raw:
            if not isinstance(edge, dict):
                continue
            pre = str(edge.get("prerequisiteKey") or "").strip()
            node = str(edge.get("nodeKey") or "").strip()
            if pre and node and pre in node_keys and node in node_keys:
                edges.append({"prerequisiteKey": pre, "nodeKey": node})

    phases: list[dict[str, Any]] = []
    for item in phases_raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        phase_goal = str(item.get("goal") or "").strip()
        if not title or not phase_goal:
            continue
        node_keys_raw = item.get("nodeKeys")
        if not isinstance(node_keys_raw, list):
            continue
        valid_keys = [str(k) for k in node_keys_raw if str(k) in node_keys]
        if not valid_keys:
            continue
        phase: dict[str, Any] = {
            "title": title,
            "goal": phase_goal,
            "nodeKeys": valid_keys,
        }
        for field in ("description", "completionCriteria"):
            value = str(item.get(field) or "").strip()
            if value:
                phase[field] = value
        phases.append(phase)

    if not phases:
        return None

    proposal_id = str(
        payload.get("proposalId") or f"ai_design_{int(datetime.utcnow().timestamp() * 1000)}"
    )
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    metadata.setdefault("provider", "fastapi")
    metadata.setdefault("model", module_llm._config.model)
    metadata.setdefault("generatedAt", datetime.utcnow().isoformat() + "Z")

    return {
        "proposalId": proposal_id,
        "metadata": metadata,
        "nodes": nodes,
        "prerequisiteEdges": edges,
        "phases": phases,
    }
