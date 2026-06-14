import json
import logging
import re
from typing import Any

from Module import module_llm

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 2


def generate_plan_proposal(
    goal: str,
    skills: list[dict[str, Any]],
    dependency_edges: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """根据技能树与学习目标生成整体计划提案 JSON。"""
    if not skills:
        raise ValueError("skills 不能为空")

    dependency_edges = dependency_edges or []
    last_error: str | None = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            raw = _call_llm_json(goal, skills, dependency_edges)
            proposal = _parse_proposal(raw, skills, dependency_edges)
            if proposal:
                return proposal
            last_error = "模型返回的计划未通过校验"
        except Exception as exc:
            last_error = str(exc)
            logger.warning(
                "generate_plan_proposal attempt %d/%d failed: %s",
                attempt,
                _MAX_ATTEMPTS,
                exc,
            )

    raise RuntimeError(last_error or "计划生成失败")


def _call_llm_json(
    goal: str,
    skills: list[dict[str, Any]],
    dependency_edges: list[dict[str, Any]],
) -> str:
    skill_lines = []
    for skill in skills:
        line = f"- id={skill.get('id')} title={skill.get('title')}"
        if skill.get("description"):
            line += f" desc={skill['description']}"
        if skill.get("parentId"):
            line += f" parentId={skill['parentId']}"
        skill_lines.append(line)

    edge_lines = [
        f"- {edge.get('sourceId')} -> {edge.get('targetId')}"
        for edge in dependency_edges
        if edge.get("sourceId") and edge.get("targetId")
    ]

    system_prompt = (
        "你是 EduTower 学习平台的整体计划助手。"
        "根据给定技能节点与学习目标准备阶段化学习计划提案。"
        "必须输出合法 JSON，不要 Markdown 代码块。"
        "JSON 字段：proposalId（字符串）、metadata（对象，含 provider/model/generatedAt）、"
        "nodes（数组，每项含 key/title，可选 description/parentKey）、"
        "prerequisiteEdges（数组，每项含 prerequisiteKey/nodeKey）、"
        "phases（数组，每项含 title/goal，可选 description/completionCriteria/nodeKeys）。"
        "nodes 的 key 必须使用 node_<技能id> 格式；nodeKeys 引用 nodes 中的 key。"
        "phases 应覆盖主要技能，按学习顺序分 2-4 个阶段。"
    )

    user_prompt = (
        f"学习目标：{goal or '未填写'}\n"
        f"技能节点（{len(skills)} 个）：\n"
        + "\n".join(skill_lines)
        + "\n依赖边：\n"
        + ("\n".join(edge_lines) if edge_lines else "（无）")
        + "\n请生成完整计划提案 JSON。"
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


def _parse_proposal(
    raw: str,
    skills: list[dict[str, Any]],
    dependency_edges: list[dict[str, Any]],
) -> dict[str, Any] | None:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    payload = json.loads(text)
    if not isinstance(payload, dict):
        return None

    skill_ids = {str(s.get("id")) for s in skills if s.get("id")}
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
        skill_id = str(item.get("id") or item.get("skillId") or "").strip()
        key = str(item.get("key") or "").strip()
        if not key and skill_id:
            key = f"node_{skill_id}"
        title = str(item.get("title") or "").strip()
        if not key or not title:
            continue
        if skill_id and skill_id not in skill_ids:
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

    if not edges and dependency_edges:
        for edge in dependency_edges:
            source_id = str(edge.get("sourceId") or "").strip()
            target_id = str(edge.get("targetId") or "").strip()
            if not source_id or not target_id:
                continue
            pre_key = f"node_{source_id}"
            node_key = f"node_{target_id}"
            if pre_key in node_keys and node_key in node_keys:
                edges.append({"prerequisiteKey": pre_key, "nodeKey": node_key})

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

    proposal_id = str(payload.get("proposalId") or f"ai_plan_{int(__import__('time').time() * 1000)}")
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    metadata.setdefault("provider", "fastapi")
    metadata.setdefault("model", module_llm._config.model)
    metadata.setdefault("generatedAt", __import__("datetime").datetime.utcnow().isoformat() + "Z")

    return {
        "proposalId": proposal_id,
        "metadata": metadata,
        "nodes": nodes,
        "prerequisiteEdges": edges,
        "phases": phases,
    }
