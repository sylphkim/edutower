"""ReAct agent for learning-assistance website."""

import json
import re
from collections import defaultdict


_PREAMBLE_MARKERS = [
    "好的", "我来", "让我", "帮你", "这就", "马上", "稍等",
    "我这就", "让我来", "我来帮", "好的呀", "好嘞", "嗯嗯",
    "明白了", "知道了", "收到", "没问题", "ok", "OK", "好呢",
    "让我看看", "我来查", "我搜索", "我查查", "我看一下",
]


class ChatAgent:
    """阻塞式 ReAct Agent，对外暴露 run() 入口。"""

    def __init__(self, tools=None):
        self.tools = tools or {"web_search": lambda q: f"[stub] web_search({q})"}
        self._history = defaultdict(list)
        self.max_steps = 10

    # ---- 公共入口 ----

    def run(self, session_id: str, message: str) -> str:
        """阻塞式 ReAct 循环，返回最终答案。"""
        self._add_history(session_id, "user", message)
        print(f"[{session_id}] User: {message}", flush=True)

        for step in range(self.max_steps):
            try:
                # ---- 思考 ----
                thought = self._think(self._history[session_id])
                print(f"[{session_id}] Thought: {thought}", flush=True)

                # ---- 决策 ----
                action = self._decide(self._history[session_id])

                if action is None:
                    final = self._finalize(self._history[session_id])
                    self._add_history(session_id, "assistant", final)
                    print(f"[{session_id}] Final: {final}", flush=True)
                    return final

                tool_name = action["tool"]
                tool_input = action["input"]
                print(f"[{session_id}] Action: {tool_name}({tool_input})", flush=True)

                # ---- 执行 ----
                observation = self._call(tool_name, tool_input)
                print(f"[{session_id}] Observation: {observation}", flush=True)
                self._add_history(session_id, "system", observation)

            except Exception as e:
                err_msg = f"[Error] Step {step}: {type(e).__name__}: {e}"
                print(f"[{session_id}] {err_msg}", flush=True)
                self._add_history(session_id, "system", err_msg)
                return f"Sorry, something went wrong: {e}"

        timeout = f"(Max steps {self.max_steps} reached.)"
        print(f"[{session_id}] Final: {timeout}", flush=True)
        return timeout

    # ---- 历史记录封装 ----

    def _add_history(self, sid: str, role: str, content: str):
        self._history[sid].append(f"{role.capitalize()}: {content}")

    # ---- 桩逻辑（后续替换为 LLM） ----

    @staticmethod
    def _think(history: list) -> str:
        if not history:
            return "Analyzing..."
        if history[-1].startswith("System:"):
            return "Processing observation..."
        return f"Considering: {history[0]}"

    @staticmethod
    def _decide(history: list) -> dict | None:
        text = "\n".join(history)
        if "System:" in text:
            return None
        q = history[0].replace("User: ", "")
        hints = ["search", "find", "look up", "what is", "tell me about"]
        if any(h in q.lower() for h in hints):
            return {"tool": "web_search", "input": q}
        return None

    @staticmethod
    def _finalize(history: list) -> str:
        m = re.search(r"System: (.+)$", "\n".join(history), re.MULTILINE)
        return f"Result: {m.group(1)}" if m else "No tools needed."

    # ---- 工具执行 ----

    def _call(self, name: str, inp: str) -> str:
        fn = self.tools.get(name)
        if not fn:
            return f"[Error] Unknown tool: {name}"
        try:
            result = fn(inp)
            return self._fmt(name, result)
        except Exception as e:
            return f"[Error] {type(e).__name__}: {e}"

    @staticmethod
    def _fmt(name: str, result) -> str:
        return f"[{name}] {result}"

    # ---- 持久化 ----

    def save_state(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dict(self._history), f, ensure_ascii=False, indent=2)

    def load_state(self, path: str):
        with open(path, "r", encoding="utf-8") as f:
            self._history = defaultdict(list, json.load(f))

    def clear(self, sid: str = None):
        if sid:
            self._history.pop(sid, None)
        else:
            self._history.clear()
