"""
Single provider-agnostic LLM client for the whole backend (chat, Hmong
translation, weather advisory bulletins). Pick the provider once in .env
(LLM_PROVIDER=DEEPSEEK or CHATGPT) with one shared LLM_API_KEY — every
caller gets the same client/model, so switching providers never means
hunting through multiple files for a hardcoded base_url or key name.

Both providers are used through the standard chat.completions endpoint
(incl. function calling), not OpenAI's newer Responses API — that keeps
every LLM-calling module in this backend portable across providers instead
of tying the weather advisory agent's tool-calling loop to OpenAI only.
"""
from openai import OpenAI

from core import config

_DEFAULT_MODELS = {
    "DEEPSEEK": "deepseek-v4-flash",
    "CHATGPT": "gpt-4o-mini",
}

_BASE_URLS = {
    "DEEPSEEK": "https://api.deepseek.com",
    "CHATGPT": None,  # OpenAI's own default base_url
}

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        base_url = _BASE_URLS.get(config.LLM_PROVIDER)
        kwargs = {"api_key": config.LLM_API_KEY}
        if base_url:
            kwargs["base_url"] = base_url
        _client = OpenAI(**kwargs)
    return _client


def get_model() -> str:
    return config.LLM_MODEL or _DEFAULT_MODELS.get(config.LLM_PROVIDER, _DEFAULT_MODELS["DEEPSEEK"])


def is_configured() -> bool:
    return bool(config.LLM_API_KEY)
