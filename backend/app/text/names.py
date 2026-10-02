"""Pull a person's name out of a short self-introduction.

This is the fallback for the app's own rules (game/systems/player_name.rpy),
used when an answer to "What's your name?" isn't a plain name or a common
phrasing like "my name is Ella". It runs a small named-entity recognition
(NER) model through the transformers library the backend already uses.

The model is downloaded on first use (~430 MB) and then kept in memory.
Override it with LANGUAGE_APP_NAME_MODEL in backend/.env if needed.
"""

import os
from functools import lru_cache
from typing import Callable, Iterable

NAME_MODEL_ID = os.getenv("LANGUAGE_APP_NAME_MODEL", "dslim/bert-base-NER")

# Ignore low-confidence guesses; the app falls back to its own best guess.
MIN_PERSON_SCORE = 0.60

NERPipeline = Callable[[str], Iterable[dict]]


@lru_cache(maxsize=1)
def _ner_pipeline() -> NERPipeline:
    from transformers import pipeline

    return pipeline(
        "token-classification",
        model=NAME_MODEL_ID,
        aggregation_strategy="simple",
    )


def extract_person_name(text: str, ner: NERPipeline | None = None) -> str | None:
    """Return the first person name found in `text`, or None.

    Typed answers are often all lowercase, which cased NER models handle
    poorly, so a title-cased copy is tried when the original finds nothing.
    """

    text = (text or "").strip()
    if not text:
        return None

    ner = ner or _ner_pipeline()

    candidates = [text]
    if text == text.lower():
        candidates.append(text.title())

    for candidate in candidates:
        people = [
            entity
            for entity in ner(candidate)
            if entity.get("entity_group") == "PER"
            and float(entity.get("score", 0.0)) >= MIN_PERSON_SCORE
        ]
        if not people:
            continue

        first = min(people, key=lambda entity: entity.get("start", 0))
        start, end = first.get("start"), first.get("end")
        if start is not None and end is not None:
            name = candidate[start:end]
        else:
            name = str(first.get("word", "")).replace(" ##", "").replace("##", "")

        name = " ".join(name.split()).strip(" .,!?;:'\"")
        if name:
            return name

    return None
