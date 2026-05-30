import re


class Translator:
    """ReAct 协议解析器：处理 LLM 输入输出的结构化转换"""

    @staticmethod
    def build_react_prompt(system_prompt: str, messages: list) -> str:
        """将消息列表转为 ReAct 格式提示文本"""
        parts = [f"System: {system_prompt}"]
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            parts.append(f"{role.capitalize()}: {content}")
        parts.append("Assistant: ")
        return "\n".join(parts)

    @staticmethod
    def parse_react_output(text: str) -> dict:
        """解析 ReAct 输出，提取 Thought/Action/ActionInput/Final"""
        result = {"thought": "", "action": "", "action_input": "", "final": ""}
        thought_match = re.search(r"Thought:\s*(.*?)(?=\n(?:Action|Final):|$)", text, re.DOTALL)
        if thought_match:
            result["thought"] = thought_match.group(1).strip()

        action_match = re.search(r"Action:\s*(\w+)", text)
        if action_match:
            result["action"] = action_match.group(1).strip()

        action_input_match = re.search(r"Action Input:\s*(.*?)(?=\n(?:Thought|Action|Final):|$)", text, re.DOTALL)
        if action_input_match:
            result["action_input"] = action_input_match.group(1).strip()

        final_match = re.search(r"Final:\s*(.*?)$", text, re.DOTALL)
        if final_match:
            result["final"] = final_match.group(1).strip()

        return result
