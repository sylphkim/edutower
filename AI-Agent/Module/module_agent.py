"""ReAct agent powered by LLM for learning-assistance website."""

import re
from collections import defaultdict

from .module_llm import call_llm
from .module_memory_extractor import append_memory_block, extract_memory_updates

# ── ReAct prompt template ──────────────────────────────────────────

SYSTEM_PROMPT = """You are EduTower AI Assistant, a helpful learning tutor. You help students review knowledge points, answer questions, and practice exercises.

You can use tools to search for information. Follow this format strictly:

Thought: <your step-by-step reasoning about what to do next>
Action: <tool_name or "Final">
Action Input: <tool input, or your final answer text>

Available tools:
- web_search(query: str) — search the web for information
- no_tool — use this when you already know the answer

When you are ready to give the final answer, use:
Action: Final
Action Input: <your complete answer to the user>

Rules:
- Always think before acting. Write your reasoning in "Thought:".
- If you don't know something, use web_search.
- Give answers in Chinese (Simplified) unless the user asks in another language.
- Be concise but thorough. Include examples when helpful.
- Never mention internal tool names or the ReAct format in your final answer."""

REACT_PATTERN = re.compile(
    r"Thought:\s*(.*?)\s*\n\s*Action:\s*(\w+)\s*\n\s*Action Input:\s*(.*)",
    re.DOTALL | re.IGNORECASE,
)
FINAL_ONLY_PATTERN = re.compile(
    r"Action:\s*Final(?:\s+Answer)?\s*\n\s*Action Input:\s*(.*)",
    re.DOTALL | re.IGNORECASE,
)


class ChatAgent:
    """LLM-powered ReAct Agent that uses call_llm for reasoning."""

    def __init__(self, tools=None):
        self.tools = tools or {
            "web_search": lambda q: f"[web_search] No results found for: {q}",
            "no_tool": lambda _: "",
        }
        self._history: dict[str, list[dict]] = defaultdict(list)
        self.max_steps = 8

    # ── Public API ────────────────────────────────────────────────

    def run(self, session_id: str, message: str, context: dict | None = None) -> str:
        """Run the ReAct loop and return the final answer."""
        hist = self._get_history(session_id)

        # Seed history from context on cold start (e.g. after process restart)
        if not hist and context:
            session_history = context.get("sessionHistory")
            if isinstance(session_history, list):
                for msg in session_history[-40:]:  # max 40 to match Express
                    if isinstance(msg, dict):
                        role = msg.get("role", "")
                        content = msg.get("content", "")
                        if role in ("user", "assistant") and content:
                            hist.append({"role": role, "content": content})

        hist.append({"role": "user", "content": message})

        system_content = SYSTEM_PROMPT
        if context:
            system_content = self._enrich_system_prompt(system_content, context)

        for step in range(self.max_steps):
            try:
                raw = call_llm(
                    messages=hist,
                    system_prompt=system_content,
                )

                parsed = self._parse_react(raw)

                print(
                    f"[{session_id}] Step {step + 1}: "
                    f"Action={parsed['action']}",
                    flush=True,
                )

                if parsed["action"].lower() in ("final", "final answer"):
                    final_text = parsed["action_input"].strip()
                    hist.append({"role": "assistant", "content": final_text})
                    self._emit(session_id, "Final", final_text)
                    return self._finalize_reply(message, final_text, context)

                tool_name = parsed["action"]
                tool_input = parsed["action_input"]
                self._emit(session_id, "Action", f"{tool_name}({tool_input})")

                observation = self._execute_tool(tool_name, tool_input)
                self._emit(session_id, "Observation", observation)

                hist.append(
                    {
                        "role": "system",
                        "content": f"Tool [{tool_name}] returned: {observation}",
                    }
                )

            except Exception as e:
                err_msg = f"[Error] Step {step}: {type(e).__name__}: {e}"
                self._emit(session_id, "[Error]", err_msg)
                hist.append({"role": "system", "content": err_msg})
                fallback = self._fallback_answer(hist)
                hist.append({"role": "assistant", "content": fallback})
                return self._finalize_reply(message, fallback, context)

        final = self._fallback_answer(hist)
        hist.append({"role": "assistant", "content": final})
        return self._finalize_reply(message, final, context)

    # ── ReAct parsing ─────────────────────────────────────────────

    @staticmethod
    def _parse_react(text: str) -> dict:
        """Parse ReAct output into {thought, action, action_input}."""
        text = text.strip()
        match = REACT_PATTERN.search(text)
        if match:
            return {
                "thought": match.group(1).strip(),
                "action": match.group(2).strip(),
                "action_input": match.group(3).strip(),
            }

        final_match = FINAL_ONLY_PATTERN.search(text)
        if final_match:
            return {
                "thought": "",
                "action": "Final",
                "action_input": final_match.group(1).strip(),
            }

        # Fallback: treat entire output as final answer
        return {
            "thought": "",
            "action": "Final",
            "action_input": text,
        }

    # ── Helpers ───────────────────────────────────────────────────

    def _get_history(self, session_id: str) -> list[dict]:
        return self._history[session_id]

    @staticmethod
    def _finalize_reply(
        user_message: str,
        reply: str,
        context: dict | None,
    ) -> str:
        """Append hidden memory_updates block for Express to parse and persist."""
        updates = extract_memory_updates(user_message, reply, context)
        return append_memory_block(reply, updates)

    @staticmethod
    def _enrich_system_prompt(base: str, context: dict) -> str:
        """Inject learning context into the system prompt."""
        parts = [base, "", "## Current Learning Context"]

        subject = context.get("subject")
        if subject and isinstance(subject, dict):
            parts.append(
                f"- Subject: {subject.get('name', 'N/A')} "
                f"(Goal: {subject.get('learningGoal', 'N/A')})"
            )

        materials = context.get("materials") or []
        if materials:
            parts.append("- Study materials:")
            for m in materials[:5]:
                if isinstance(m, dict):
                    parts.append(f"  * {m.get('title', '?')}: {m.get('summary', '')}")
                    snippet = (m.get("contentSnippet") or "").strip()
                    if snippet:
                        preview = snippet[:800]
                        parts.append(f"    (content excerpt) {preview}")

        knowledge_points = context.get("knowledgePoints") or []
        if knowledge_points:
            parts.append("- Knowledge points & mastery:")
            for kp in knowledge_points[:8]:
                if isinstance(kp, dict):
                    parts.append(
                        f"  * {kp.get('title', '?')} (mastery: {kp.get('mastery', 0)}%)"
                    )

        weak_points = context.get("weakPoints") or []
        if weak_points:
            parts.append("- Weak areas to focus on:")
            for wp in weak_points[:5]:
                if isinstance(wp, dict):
                    parts.append(
                        f"  * {wp.get('title', '?')} — {wp.get('reason', '')} "
                        f"(suggested: {wp.get('suggestedAction', '')})"
                    )

        wrongbook_items = context.get("wrongbookItems") or []
        if wrongbook_items:
            parts.append("- Recent wrong answers:")
            for wb in wrongbook_items[:5]:
                if isinstance(wb, dict):
                    parts.append(
                        f"  * Q: {wb.get('question', '')} | "
                        f"Wrong: {wb.get('wrongAnswer', '')} | "
                        f"Correct: {wb.get('correctAnswer', '')}"
                    )

        memories = context.get("memories") or []
        if memories:
            parts.append("- Long-term memories:")
            for mem in memories[:8]:
                if isinstance(mem, dict):
                    parts.append(
                        f"  * [{mem.get('type', '?')}] {mem.get('title', '?')}: "
                        f"{mem.get('content', '')}"
                    )

        return "\n".join(parts)

    @staticmethod
    def _emit(session_id: str, label: str, content: str):
        """Print structured log to stdout."""
        preview = content[:200] + "…" if len(content) > 200 else content
        print(f"[{session_id}] {label}: {preview}", flush=True)

    def _execute_tool(self, name: str, inp: str) -> str:
        fn = self.tools.get(name)
        if not fn:
            return f"[Error] Unknown tool: {name}"
        try:
            return str(fn(inp))
        except Exception as e:
            return f"[Error] {type(e).__name__}: {e}"

    def _fallback_answer(self, hist: list[dict]) -> str:
        """Generate a graceful fallback when the agent gets stuck."""
        try:
            msgs = hist + [
                {
                    "role": "system",
                    "content": (
                        "The agent loop ended. Please give a brief, helpful summary "
                        "of what you know so far, in Chinese."
                    ),
                }
            ]
            return call_llm(messages=msgs, system_prompt=SYSTEM_PROMPT)
        except Exception:
            return "抱歉，处理您的请求时遇到了问题。请稍后再试。"

    # ── Persistence ───────────────────────────────────────────────

    def clear(self, sid: str | None = None):
        if sid:
            self._history.pop(sid, None)
        else:
            self._history.clear()
