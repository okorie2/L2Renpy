"""Shared test setup."""

import os

# Tests log to the terminal only, never to backend/logs.
os.environ.setdefault("LOG_FILE", "off")
