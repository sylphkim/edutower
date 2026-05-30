from collections import defaultdict, deque
import json
import os


class Memory:
    """对话记忆管理器：按 session 存储消息历史，支持持久化"""

    def __init__(self, max_history: int = 50, persist_path: str = None):
        self.max_history = max_history
        self.persist_path = persist_path
        self._sessions = defaultdict(lambda: deque(maxlen=max_history))

    def add_message(self, session_id: str, role: str, content: str):
        """向指定会话添加消息"""
        self._sessions[session_id].append({
            "role": role,
            "content": content
        })

    def get_history(self, session_id: str) -> list:
        """获取指定会话的消息历史（返回列表副本）"""
        return list(self._sessions.get(session_id, []))

    def clear_session(self, session_id: str):
        """清空指定会话"""
        if session_id in self._sessions:
            del self._sessions[session_id]

    def save(self, path: str = None):
        """持久化所有会话到 JSON 文件"""
        target = path or self.persist_path
        if not target:
            return
        data = {k: list(v) for k, v in self._sessions.items()}
        dirname = os.path.dirname(target)
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, path: str = None):
        """从 JSON 文件加载会话历史"""
        target = path or self.persist_path
        if not target or not os.path.exists(target):
            return
        with open(target, "r", encoding="utf-8") as f:
            data = json.load(f)
        for sid, msgs in data.items():
            dq = deque(maxlen=self.max_history)
            dq.extend(msgs)
            self._sessions[sid] = dq
