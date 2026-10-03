"""Logging for the backend: one readable line per event, in the terminal and in a file.

Every line carries the id of the request it belongs to, so one failing call can
be followed from the game to the provider and back. The game sends its own id
(``X-Request-Id``) and shows it with the error, so the two sides can be matched.

Settings (``backend/.env``):
  LOG_LEVEL   DEBUG, INFO (default), WARNING or ERROR
  LOG_FILE    where the file goes (default ``backend/logs/backend.log``); ``off`` for none.
              It is rotated at 2 MB, keeping five old files.
"""

import contextvars
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .config import BACKEND_DIR

request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

FORMAT = "%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"


class _RequestId(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id.get()
        return True


def log_file() -> Path | None:
    raw = os.getenv("LOG_FILE", "").strip()
    if raw.lower() in ("off", "none", "false", "0"):
        return None
    path = Path(raw) if raw else BACKEND_DIR / "logs" / "backend.log"
    return path if path.is_absolute() else BACKEND_DIR / path


def configure() -> Path | None:
    """Set up the terminal and file logs once. Returns the file, if there is one."""

    root = logging.getLogger()
    if getattr(root, "_second_language", False):
        return log_file()
    root._second_language = True  # type: ignore[attr-defined]
    level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").strip().upper(), logging.INFO)
    root.setLevel(level)
    formatter = logging.Formatter(FORMAT, datefmt="%H:%M:%S")
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    path = log_file()
    if path is not None:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            handlers.append(RotatingFileHandler(path, maxBytes=2_000_000, backupCount=5, encoding="utf-8"))
        except OSError:
            path = None
    for handler in list(root.handlers):
        root.removeHandler(handler)
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.addFilter(_RequestId())
        root.addHandler(handler)
    # Uvicorn's own access lines repeat ours without the request id.
    logging.getLogger("uvicorn.access").disabled = True
    # The HTTP clients log every call at INFO; keep them for debugging only.
    for noisy in ("httpx", "httpcore", "urllib3"):
        logging.getLogger(noisy).setLevel(max(level, logging.WARNING))
    return path
