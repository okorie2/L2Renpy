# Work out the player's name from their answer to "What's your name?".
#
# Players often answer with a sentence ("my name is Ella", "hi, I'm Ella from
# London"). Simple rules handle the common phrasings instantly and offline.
# When the rules aren't confident (an unusual phrasing), the backend's name
# model is asked instead (POST /text/extract-name); if that is unavailable the
# rules' best guess is used.
#
# Usage in a script:
#     $ name_lookup = PlayerNameLookup(answer_text)
#     while name_lookup.pending ...   (see opening_scene.rpy)
#     $ player_name = name_lookup.name

init python:
    import re


    # Fillers that can come before the answer.
    _NAME_GREETINGS = {
        "hi", "hello", "hey", "hiya", "heya", "well", "um", "umm", "uh", "uhm",
        "er", "erm", "so", "oh", "yeah", "yes", "okay", "ok", "sure", "right",
        "alright", "bonjour", "salut", "there", "sophie",
    }

    # Phrases that introduce the name. "Strong" ones are found anywhere in
    # the answer; "weak" ones only count at the start (they also appear in
    # ordinary sentences, e.g. "it's nice to meet you").
    _NAME_GREETING_PHRASES = [
        "nice to meet you", "pleased to meet you", "good morning",
        "good afternoon", "good evening", "how are you",
    ]

    _NAME_STRONG_LEAD_INS = [
        "my first name is", "my name is", "my name's", "my names", "the name is",
        "the name's", "name is", "name's", "you can call me", "just call me",
        "people call me", "everyone calls me", "they call me", "call me",
        "i am called", "i'm called", "i go by", "known as", "knows me as",
        "know me as", "je m'appelle", "mon nom est", "moi c'est",
    ]
    _NAME_WEAK_LEAD_INS = [
        "i am", "i'm", "im", "it is", "it's", "its", "this is", "here is",
        "je suis", "c'est", "me",
    ]

    # Words that end the name ("Ella from London", "Ella and I'm 24").
    _NAME_STOP_WORDS = {
        "and", "from", "but", "or", "i", "i'm", "im", "nice", "pleased", "thanks",
        "thank", "please", "who", "living", "live", "years", "year", "old",
        "aged", "age", "a", "an", "the", "learning", "studying", "student",
        "here", "to", "of", "in", "at", "with", "is", "am", "are", "was", "not",
        "sure", "name", "names", "my", "your", "what", "what's", "whats",
        "don't", "dont", "know", "it", "it's", "its", "too", "also", "by",
        "the", "for", "today", "now", "yeah", "yes", "no", "okay", "ok",
    }

    _NAME_MAX_WORDS = 3

    _NAME_WORD_RE = re.compile(r"[^\W\d_]+(?:['\-][^\W\d_]+)*", re.UNICODE)


    def _name_words(text):
        text = (text or "").replace("’", "'").replace("‘", "'")
        return _NAME_WORD_RE.findall(text)


    def _strip_phrase_at(lowers, start, phrase):
        """Return the index after `phrase` if it occurs at `start`, else None."""

        parts = phrase.split()
        if lowers[start:start + len(parts)] == parts:
            return start + len(parts)
        return None


    def _format_name_word(word):
        """Ella, Mary-Jane, O'Brien; keep deliberate mixed case (McKenzie)."""

        if word != word.lower() and word != word.upper():
            return word

        return re.sub(
            r"(^|[-'])([^\W\d_])",
            lambda m: m.group(1) + m.group(2).upper(),
            word.lower(),
        )


    def _skip_greetings(lowers, i):
        """Skip fillers and greeting phrases starting at index i."""

        while i < len(lowers):
            if lowers[i] in _NAME_GREETINGS:
                i += 1
                continue
            for phrase in _NAME_GREETING_PHRASES:
                end = _strip_phrase_at(lowers, i, phrase)
                if end is not None:
                    i = end
                    break
            else:
                break
        return i


    def format_player_name(text):
        words = _name_words(text)[:_NAME_MAX_WORDS]
        return " ".join(_format_name_word(w) for w in words)


    def parse_player_name(text):
        """Return (name, confident) using rules only.

        confident is False when the answer doesn't look like a name or a
        common phrasing; name is then a best guess (possibly "").
        """

        words = _name_words(text)
        lowers = [w.lower() for w in words]
        if not words:
            return "", False

        i = _skip_greetings(lowers, 0)

        lead_in_found = False

        # Strong lead-in anywhere ("hello there, my name is Ella").
        for start in range(i, len(lowers)):
            for phrase in _NAME_STRONG_LEAD_INS:
                end = _strip_phrase_at(lowers, start, phrase)
                if end is not None:
                    i, lead_in_found = end, True
                    break
            if lead_in_found:
                break

        # Weak lead-in only at the start ("I'm Ella", "it's Ella").
        if not lead_in_found:
            for phrase in _NAME_WEAK_LEAD_INS:
                end = _strip_phrase_at(lowers, i, phrase)
                if end is not None:
                    i, lead_in_found = end, True
                    break

        # "my name is, um, Ella"
        i = _skip_greetings(lowers, i)

        rest = words[i:]
        name_words = []
        for word in rest:
            if word.lower() in _NAME_STOP_WORDS:
                break
            name_words.append(word)

        stopped_early = len(name_words) < len(rest)

        if lead_in_found:
            confident = 1 <= len(name_words) <= _NAME_MAX_WORDS
        else:
            # A bare answer: just the name, with nothing else after it.
            confident = (
                1 <= len(name_words) <= _NAME_MAX_WORDS and not stopped_early
            )

        name = " ".join(
            _format_name_word(w) for w in name_words[:_NAME_MAX_WORDS]
        )
        return name, confident


    def request_name_from_backend(text):
        """Ask the backend's name model; returns a name or None."""

        import requests

        url = _speech_api_base_url() + "/text/extract-name"
        renpy.log("Speech API: POST {}".format(url))
        response = requests.post(url, json={"text": text}, timeout=(3, 8))
        if response.status_code >= 400:
            renpy.log(
                "Name API: status {} {}".format(
                    response.status_code, response.text[:200]
                )
            )
            return None
        return (response.json() or {}).get("name")


    class PlayerNameLookup(object):
        """Rules first; ask the backend model in a thread only if needed."""

        def __init__(self, text):
            self.text = (text or "").strip()
            self.name, confident = parse_player_name(self.text)
            self.pending = False

            if self.text and not confident:
                self.pending = True
                renpy.invoke_in_thread(self._ask_backend)

        def _ask_backend(self):
            found = None
            try:
                found = request_name_from_backend(self.text)
            except Exception as exc:
                renpy.log("Name API: request failed {!r}".format(exc))
            renpy.invoke_in_main_thread(self._finish, found)

        def _finish(self, found):
            if found:
                self.name = format_player_name(found)
            self.pending = False
            renpy.restart_interaction()
