import os
import time
import logging
from pathlib import Path
from typing import List, Dict, Generator
from openai import OpenAI, APIConnectionError, APITimeoutError
import httpx
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# 加载 Module 目录下的 .env 文件
_ENV_PATH = Path(__file__).resolve().parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)
else:
    # 回退：尝试加载项目根目录的 .env
    _ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
    if _ROOT_ENV.exists():
        load_dotenv(_ROOT_ENV)

_LLM_TIMEOUT = httpx.Timeout(600.0, connect=15.0)
_MAX_RETRIES = 3
_RETRY_BACKOFF = [1.0, 2.0, 4.0]


def _is_transient_error(exc: Exception) -> bool:
    if isinstance(exc, (httpx.NetworkError, httpx.TimeoutException)):
        return True
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return True
    from openai import InternalServerError
    if isinstance(exc, InternalServerError):
        return True
    status_err = getattr(exc, "status_code", None)
    if status_err is not None and status_err in (502, 503, 504):
        return True
    return False


class LLMConfig:
    """LLM 模块配置"""
    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        top_p: float = 1.0,
        system_prompt: str = "You are a helpful assistant.",
    ):
        # 优先级：显式传入 > 环境变量 > 硬编码默认值
        self.api_key = api_key or os.getenv("LLM_API_KEY") or os.getenv("DEEPSEEK_API_KEY") or ""
        self.base_url = base_url or os.getenv("LLM_BASE_URL") or "https://api.deepseek.com"
        self.model = model or os.getenv("LLM_MODEL") or "deepseek-v4-flash"
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.top_p = top_p
        self.system_prompt = system_prompt


_config = LLMConfig()


def configure(**kwargs):
    for k, v in kwargs.items():
        if hasattr(_config, k):
            setattr(_config, k, v)


def _build_client() -> OpenAI:
    return OpenAI(
        api_key=_config.api_key,
        base_url=_config.base_url,
        http_client=httpx.Client(timeout=_LLM_TIMEOUT),
    )


def _call_with_retry(messages: List[Dict], stream: bool = False) -> str | Generator:
    client = _build_client()
    last_exc = None

    for attempt in range(_MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=_config.model,
                messages=messages,
                max_tokens=_config.max_tokens,
                temperature=_config.temperature,
                top_p=_config.top_p,
                stream=stream,
            )
            if stream:
                return _stream_response(response)
            return response.choices[0].message.content
        except Exception as e:
            last_exc = e
            if _is_transient_error(e) and attempt < _MAX_RETRIES - 1:
                wait = _RETRY_BACKOFF[attempt]
                logger.warning("LLM call failed (attempt %d/%d), retrying in %.1fs: %s",
                               attempt + 1, _MAX_RETRIES, wait, e)
                time.sleep(wait)
                continue
            raise


def _stream_response(response) -> Generator:
    for chunk in response:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content


def call_llm(messages: List[Dict], **overrides) -> str:
    msgs = []
    if _config.system_prompt:
        msgs.append({"role": "system", "content": _config.system_prompt})
    msgs.extend(messages)

    return _call_with_retry(msgs, stream=False)


def call_llm_stream(messages: List[Dict], **overrides) -> Generator:
    msgs = []
    if _config.system_prompt:
        msgs.append({"role": "system", "content": _config.system_prompt})
    msgs.extend(messages)

    yield from _call_with_retry(msgs, stream=True)
