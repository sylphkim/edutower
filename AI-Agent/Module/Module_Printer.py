from datetime import datetime


class Printer:
    """日志打印器：统一输出格式，支持 info / warn / error / debug 级别"""

    def __init__(self):
        self._logs = []

    LEVEL_COLORS = {
        "INFO": "\033[92m",     # 绿色
        "WARN": "\033[93m",     # 黄色
        "ERROR": "\033[91m",    # 红色
        "DEBUG": "\033[94m",    # 蓝色
    }
    RESET = "\033[0m"

    def _timestamp(self) -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _log(self, level: str, message: str):
        color = self.LEVEL_COLORS.get(level, "")
        formatted = f"{color}[{level}]{self.RESET} {self._timestamp()} | {message}"
        print(formatted)
        self._logs.append({"level": level, "message": message, "timestamp": self._timestamp()})

    def on_info(self, message: str):
        self._log("INFO", message)

    def on_warn(self, message: str):
        self._log("WARN", message)

    def on_error(self, message: str):
        self._log("ERROR", message)

    def on_debug(self, message: str):
        self._log("DEBUG", message)

    def get_last_logs(self, n: int = 10) -> list:
        return self._logs[-n:]

    def clear_logs(self):
        self._logs.clear()

    def on_stream_chunk(self, chunk: str):
        """流式输出，不换行"""
        print(chunk, end="", flush=True)

    def on_step_start(self, step_info: str):
        self._log("INFO", f"⏳ 步骤开始: {step_info}")

    def on_step_end(self, step_info: str, result: str = ""):
        self._log("INFO", f"✅ 步骤完成: {step_info}")
        if result:
            self._log("DEBUG", f"   结果: {result[:200]}")
