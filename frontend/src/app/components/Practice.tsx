import { useEffect, useRef, useState } from "react";
import { PracticeRequestError, type PracticeClient } from "../../speech/httpPractice";
import {
  createPhrasePicker, practiceExpression, practiceSpeech, practiceTarget, recordAttempt, startPractice,
  type PracticeState, type PracticeUtterance, type PracticeWord
} from "../../speech/practice";
import type { CharacterExpression } from "../../characters/types";
import type { SpeechRate } from "../../speech/types";
import { icons } from "../icons";
import { RecordingError, startRecording, type Recording } from "../recorder";
import type { SpeakerState, SpokenItem } from "../voice";
import { traceText } from "./TracedText";

export interface PracticeLine {
  text: string;
  translation?: string;
}

type Props = {
  lines: PracticeLine[];
  /** Words that are not graded, such as the learner's own name. */
  excluded: string[];
  languageCode: string;
  /** The learner's own language, for Sophie's prompts. */
  interfaceLanguageCode: string;
  /** Whose voice is the model: the character who taught the line. */
  speakerId?: string;
  practice?: PracticeClient;
  /** The microphone and the backend's pronunciation check are both available. */
  canPractise: boolean;
  speaking: SpeakerState | null;
  speak: (items: SpokenItem[]) => Promise<void>;
  onDone: () => void;
  /** How Sophie should look right now: a gesture for what she is saying, or listening. */
  onExpression?: (expression: CharacterExpression) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "checking" }
  | { kind: "error"; message: string; fatal: boolean };

function WordMarks({ words, languageCode }: { words: PracticeWord[]; languageCode: string }) {
  return (
    <p className="practice-words" lang={languageCode}>
      {words.map((word) => (
        <span key={`${word.index}-${word.word}`} className={!word.scored ? "word-unscored" : word.needsPractice ? "word-practise" : "word-clear"}>
          {word.word}
        </span>
      ))}
    </p>
  );
}

/**
 * Pronunciation practice on the lines Sophie just taught. She says each line;
 * the learner says it back; she answers ("Great!", "That was a good try. Let's
 * practise this part.") and says the next thing to copy. Attempts are finite, so
 * the practice always ends, and how it went never decides progress.
 */
export function Practice({ lines, excluded, languageCode, interfaceLanguageCode, speakerId, practice, canPractise, speaking, speak, onDone, onExpression }: Props) {
  const [state, setState] = useState<PracticeState>(startPractice);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // What Sophie last said to steer the practice, shown as a caption.
  const [caption, setCaption] = useState<string | undefined>(undefined);
  const [pick] = useState(() => createPhrasePicker());
  const recording = useRef<Recording | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  const turn = useRef(0);
  const texts = lines.map((line) => line.text);
  const target = practiceTarget(state, texts);
  const line = lines[state.lineIndex];

  const say = (utterances: PracticeUtterance[], rate: SpeechRate = "normal") => speak(utterances.map((item) => ({
    text: item.text,
    languageCode: item.kind === "prompt" ? interfaceLanguageCode : languageCode,
    speakerId,
    rate: item.kind === "target" ? rate : "normal",
    ...(item.kind === "target" && item.context ? { context: item.context } : {})
  })));
  const captionOf = (utterances: PracticeUtterance[]) => utterances.filter((item) => item.kind === "prompt").map((item) => item.text).join(" ") || undefined;

  useEffect(() => {
    // Begin by hearing the first line.
    if (canPractise && lines[0]) {
      const opening: PracticeUtterance[] = [{ kind: "prompt", text: pick("listenFirst") }, { kind: "target", text: lines[0].text }];
      setCaption(captionOf(opening));
      void say(opening);
    }
    return () => {
      turn.current++;
      recording.current?.cancel();
      request.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Her gesture follows what she says; while the learner speaks, she listens.
  const expression = practiceExpression(status.kind === "recording" || status.kind === "checking" ? undefined : speaking?.item, languageCode);
  useEffect(() => onExpression?.(expression), [expression, onExpression]);

  if (!canPractise) {
    return (
      <div className="practice">
        <p className="turn-prompt">Listen to each line and say it aloud.</p>
        <ol className="practice-list">
          {lines.map((item) => {
            const playing = speaking?.item.text === item.text;
            return (
              <li key={item.text}>
                <button
                  className={`assist-chip${playing ? " active" : ""}`}
                  aria-pressed={playing}
                  onClick={() => void say([{ kind: "target", text: item.text }])}
                  aria-label={`Hear: ${item.text}`}
                >
                  ▶
                </button>
                <span>
                  <span className="target-language small" lang={languageCode}>{playing ? traceText(item.text, speaking?.words, speaking?.activeWord) : item.text}</span>
                  {item.translation && <span className="translation small">{item.translation}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <button className="primary-pill" onClick={onDone}>Continue</button>
      </div>
    );
  }

  if (!target) return null;

  const finish = async () => {
    const active = recording.current;
    if (!active || !practice) return;
    recording.current = undefined;
    const current = turn.current;
    setStatus({ kind: "checking" });
    try {
      const clip = await active.stop();
      const controller = new AbortController();
      request.current = controller;
      const result = await practice.attempt({ audio: clip, text: target.text, languageCode, speakerId, excluded, context: target.context, signal: controller.signal });
      if (current !== turn.current) return;
      setStatus({ kind: "idle" });
      const next = recordAttempt(state, result, lines.length, texts);
      setState(next);
      const reply = practiceSpeech(next, texts, pick);
      setCaption(captionOf(reply));
      await say(reply);
      if (next.done && current === turn.current) onDone();
    } catch (error) {
      if (current !== turn.current) return;
      if (error instanceof RecordingError) {
        const blocked = error.kind === "permission-denied" || error.kind === "no-microphone" || error.kind === "unavailable";
        setStatus({ kind: "error", fatal: blocked, message: blocked ? "The microphone can't be used, so practice is skipped." : "I didn't catch that. Try again, a little closer." });
      } else if (error instanceof PracticeRequestError && error.status < 500 && error.status !== 422) {
        setStatus({ kind: "error", fatal: false, message: "That didn't work. Try again." });
      } else {
        setStatus({ kind: "error", fatal: true, message: "Pronunciation feedback isn't available right now." });
      }
    }
  };

  const begin = async () => {
    const current = ++turn.current;
    // Sophie stops talking when the learner starts.
    void speak([]);
    try {
      const started = await startRecording(() => void finish());
      if (current !== turn.current) {
        started.cancel();
        return;
      }
      recording.current = started;
      setStatus({ kind: "recording" });
    } catch (error) {
      if (current !== turn.current) return;
      setStatus({ kind: "error", fatal: true, message: error instanceof RecordingError && error.kind === "permission-denied"
        ? "The microphone is blocked, so practice is skipped. You can allow it in Settings."
        : "The microphone can't be used here, so practice is skipped." });
    }
  };

  const recordingNow = status.kind === "recording";
  const checking = status.kind === "checking";
  const targetPlaying = speaking?.item.text === target.text && speaking.item.languageCode === languageCode;
  const playingRate = targetPlaying ? speaking?.item.rate ?? "normal" : undefined;
  const sophieTalking = speaking !== null;

  return (
    <div className="practice">
      <div className="practice-head">
        {target.mode === "phrase" && <span className="eyebrow">{`LINE ${state.lineIndex + 1} OF ${lines.length}`}</span>}
        {caption && <span className="practice-caption" role="status">{caption}</span>}
      </div>
      {state.lastWords && state.lastWords.length > 0 && target.mode === "phrase" && state.feedback?.kind !== "clear" && (
        <WordMarks words={state.lastWords} languageCode={languageCode} />
      )}
      <p className="target-language" lang={languageCode}>
        {targetPlaying ? traceText(target.text, speaking?.words, speaking?.activeWord) : target.text}
      </p>
      {target.mode === "phrase" && line?.translation && <p className="translation">{line.translation}</p>}
      {target.guide && <p className="hint-text">Sounds like: <strong>{target.guide}</strong></p>}

      {status.kind === "error" && status.fatal ? (
        <div className="practice-controls">
          <p className="speech-status" role="status">{status.message}</p>
          <button className="primary-pill" onClick={onDone}>Continue</button>
        </div>
      ) : (
        <div className="practice-controls">
          <button
            className={`assist-chip${playingRate === "normal" ? " active" : ""}`}
            aria-pressed={playingRate === "normal"}
            onClick={() => void say([{ kind: "target", text: target.text, context: target.context }])}
            disabled={recordingNow || checking}
          >
            {playingRate === "normal" ? "Playing…" : "Listen"}
          </button>
          <button
            className={`mic-button${recordingNow ? " recording" : ""}`}
            onClick={() => (recordingNow ? void finish() : void begin())}
            disabled={checking}
            aria-label={recordingNow ? "Finish speaking" : "Say it"}
          >
            <img src={recordingNow ? icons.stop : icons.microphone} alt="" />
          </button>
          <button
            className={`assist-chip${playingRate === "slow" ? " active" : ""}`}
            aria-pressed={playingRate === "slow"}
            onClick={() => void say([{ kind: "target", text: target.text, context: target.context }], "slow")}
            disabled={recordingNow || checking}
          >
            {playingRate === "slow" ? "Playing…" : "Slower"}
          </button>
        </div>
      )}
      {!(status.kind === "error" && status.fatal) && (
        <p className="speech-status" role="status">
          {status.kind === "error" ? status.message
            : recordingNow ? "Listening… tap when you've finished."
            : checking ? "Listening back…"
            : sophieTalking ? "Sophie is speaking…"
            : "Tap the microphone and say it."}
        </p>
      )}
    </div>
  );
}
