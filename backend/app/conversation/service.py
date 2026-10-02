"""The AI second opinion on a learner turn: model, cache, limits and errors.

Nothing here touches game state, and the game works without it.

Settings (backend/.env):
  OPENROUTER_API_KEY      the key; without it the layer is off
  AI_PROVIDER             "openrouter" (default when a key is present) or "none"
  AI_MODEL                default google/gemini-3.1-flash-lite
  AI_BASE_URL             default https://openrouter.ai/api/v1
  AI_TIMEOUT_MS           default 8000, per model call
  AI_REQUESTS_PER_MINUTE  default 60, across all players
"""

import hashlib
import logging
import os
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Protocol

import httpx

from .. import config
from .turn import InvalidTurnError, build_turn_prompt, read_turn_judgement, read_turn_request, turn_schema

logger = logging.getLogger(__name__)

# A judgement is a few short fields; this leaves room without allowing an essay.
MAX_OUTPUT_TOKENS = 300
CACHE_ENTRIES = 300
WINDOW_SECONDS = 60.0


class TurnError(Exception):
    """A failure with the HTTP status the API should answer with."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass
class ChatReply:
    text: str
    input_tokens: int | None = None
    output_tokens: int | None = None


class ChatModel(Protocol):
    """Text in, structured text out. Which company or model answers is an adapter's business."""

    id: str
    model: str

    def complete(self, system: str, user: str, schema: dict, max_output_tokens: int, timeout: float) -> ChatReply: ...


class OpenRouterModel:
    """OpenRouter, which speaks the OpenAI chat-completions format.

    Learner text is only routed to providers that do not keep it for training
    (``data_collection: "deny"``).
    """

    id = "openrouter"

    def __init__(self, api_key: str, model: str, base_url: str, client: httpx.Client | None = None):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.client = client or httpx.Client()

    def complete(self, system: str, user: str, schema: dict, max_output_tokens: int, timeout: float) -> ChatReply:
        try:
            response = self.client.post(
                self.base_url + "/chat/completions",
                timeout=timeout,
                headers={"Authorization": "Bearer " + self.api_key},
                json={
                    "model": self.model,
                    "max_tokens": max_output_tokens,
                    "temperature": 0.2,
                    "provider": {"data_collection": "deny"},
                    "response_format": {"type": "json_schema", "json_schema": {"name": "turn", "strict": True, "schema": schema}},
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                },
            )
        except httpx.HTTPError as exc:
            raise TurnError(503, "the language model is not reachable") from exc
        if response.status_code >= 400:
            raise TurnError(503, "the language model answered {}".format(response.status_code))
        try:
            body = response.json()
            text = body["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise TurnError(502, "the language model returned no text") from exc
        if not isinstance(text, str):
            raise TurnError(502, "the language model returned no text")
        usage = body.get("usage") or {}
        return ChatReply(text=text, input_tokens=usage.get("prompt_tokens"), output_tokens=usage.get("completion_tokens"))


def _settings() -> dict:
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    return {
        "provider": os.getenv("AI_PROVIDER", "openrouter" if key else "none").strip().lower(),
        "api_key": key,
        "model": os.getenv("AI_MODEL", "google/gemini-3.1-flash-lite").strip(),
        "base_url": os.getenv("AI_BASE_URL", "https://openrouter.ai/api/v1").strip(),
        "timeout": float(os.getenv("AI_TIMEOUT_MS", "8000")) / 1000,
        "per_minute": int(os.getenv("AI_REQUESTS_PER_MINUTE", "60")),
    }


def create_chat_model() -> ChatModel | None:
    settings = _settings()
    if settings["provider"] == "openrouter" and settings["api_key"]:
        return OpenRouterModel(settings["api_key"], settings["model"], settings["base_url"])
    return None


class ConversationService:
    def __init__(self, model: ChatModel | None = None, *, use_configured_model: bool = True, clock=time.monotonic):
        self.model = model if model is not None or not use_configured_model else create_chat_model()
        self.clock = clock
        self.cache: OrderedDict[str, dict] = OrderedDict()
        self.calls: list[float] = []
        self.lock = threading.Lock()

    def available(self) -> bool:
        """Whether a second opinion can be asked for right now."""
        return self.model is not None

    def _take_call(self, now: float, per_minute: int) -> None:
        with self.lock:
            self.calls = [at for at in self.calls if now - at < WINDOW_SECONDS]
            if len(self.calls) >= per_minute:
                raise TurnError(429, "the AI conversation layer is busy")
            self.calls.append(now)

    def judge_turn(self, body) -> dict:
        """Ask the model what the learner meant. The answer is checked and returned as advice."""

        settings = _settings()
        try:
            request = read_turn_request(body, config.speech_languages())
        except InvalidTurnError as exc:
            raise TurnError(400, str(exc)) from exc
        if self.model is None:
            raise TurnError(503, "the AI conversation layer is not configured")

        system, user = build_turn_prompt(request)
        # The same words in the same scene get the same answer, and are paid for once.
        key = hashlib.sha256("\n".join([self.model.id, self.model.model, system, user]).encode("utf-8")).hexdigest()
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
                return self.cache[key]

        now = self.clock()
        self._take_call(now, settings["per_minute"])
        schema = turn_schema(request)
        started = time.perf_counter()

        def ask():
            reply = self.model.complete(system, user, schema, MAX_OUTPUT_TOKENS, settings["timeout"])
            return reply, read_turn_judgement(reply.text, request)

        try:
            try:
                reply, judgement = ask()
            except InvalidTurnError:
                # Models occasionally return a malformed reply; one more try usually settles it.
                self._take_call(now, settings["per_minute"] + 1)
                reply, judgement = ask()
        except InvalidTurnError as exc:
            logger.warning("Discarded a model reply: %s", exc)
            raise TurnError(502, "the language model gave an unusable answer") from exc
        except Exception as exc:  # noqa: BLE001 - any model failure means "go without"
            logger.warning("The language model failed after %.0f ms: %s", (time.perf_counter() - started) * 1000, exc)
            raise TurnError(503, "the language model is not available") from exc

        # Log sizes and timings only; never what the learner or the model said.
        logger.info(
            "Judged a turn in %.0f ms (%s in, %s out, intent %s)",
            (time.perf_counter() - started) * 1000,
            reply.input_tokens if reply.input_tokens is not None else "?",
            reply.output_tokens if reply.output_tokens is not None else "?",
            "detected" if judgement["detectedIntent"] else "not detected",
        )
        with self.lock:
            self.cache[key] = judgement
            while len(self.cache) > CACHE_ENTRIES:
                self.cache.popitem(last=False)
        return judgement
