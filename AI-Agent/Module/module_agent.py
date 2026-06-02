"""ReAct agent for learning-assistance website."""

import json
import re
from collections import defaultdict

from .module_llm import call_llm


class ChatAgent:
    """阻塞式 ReAct Agent，对外暴露 run() 入口。"""

    def __init__(self, tools=None):
        self.tools = tools or {"web_search": lambda q: f"[stub] web_search({q})"}
        self._history = defaultdict(list)
        self.max_steps = 10

    # ---- 公共入口 ----

    def run(self, session_id: str, message: str) -> str:
        """阻塞式 ReAct 循环，返回最终答案。"""
        hist = self._history[session_id]
        self._add_to_history(hist, "user", message)
        self._emit(session_id, "User", message)

        for step in range(self.max_steps):
            try:
                thought = self._think(hist)
                self._emit(session_id, "Thought", thought)
                # Thought / Action 仅调试输出，不入历史

                action = self._decide(hist)

                if action is None:
                    final = self._finalize(hist)
                    self._add_to_history(hist, "assistant", final)
                    self._emit(session_id, "Final", final)
                    return final

                tool_name = action["tool"]
                tool_input = action["input"]
                self._emit(session_id, "Action", f"{tool_name}({tool_input})")

                observation = self._execute_tool(tool_name, tool_input)
                self._emit(session_id, "Observation", observation)
                self._add_to_history(hist, "system", observation)

            except Exception as e:
                err_msg = f"[Error] Step {step}: {type(e).__name__}: {e}"
                self._emit(session_id, "[Error]", err_msg)
                self._add_to_history(hist, "system", err_msg)
                return f"Sorry, something went wrong: {e}"

        timeout = f"(Max steps {self.max_steps} reached.)"
        self._emit(session_id, "Final", timeout)
        return timeout

    # ---- 策略区（后续替换为 LLM） ----

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

    # ---- 执行区 ----

    def _execute_tool(self, name: str, inp: str) -> str:
        fn = self.tools.get(name)
        if not fn:
            return f"[Error] Unknown tool: {name}"
        try:
            return f"[{name}] {fn(inp)}"
        except Exception as e:
            return f"[Error] {type(e).__name__}: {e}"

    # ---- 持久化区 ----

    @staticmethod
    def _add_to_history(hist: list, role: str, content: str):
        """追加记录到历史列表，不打印。"""
        hist.append(f"{role.capitalize()}: {content}")

    @staticmethod
    def _emit(session_id: str, label: str, content: str):
        """打印日志到 stdout，不修改历史状态。"""
        print(f"[{session_id}] {label}: {content}", flush=True)

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
