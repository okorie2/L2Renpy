import { useEffect, useRef, useState } from "react";
import { PracticeRequestError, type PracticeClient } from "../../speech/httpPractice";
import { feedbackText, practiceTarget, recordAttempt, skipLine, startPractice, type PracticeWord } from "../../speech/practice";
import type { SpeechRate } from "../../speech/types";
import { icons } from "../icons";
import { RecordingError, startRecording, type Recording } from "../recorder";
import { stopVoice } from "../voice";

export interface PracticeLine {
  text: string;
  translation?: string;
}

type Props = {
  lines: PracticeLine[];
  /** Words that are not graded, such as the learner's own name. */
  excluded: string[];
  languageCode: string;
  /** Whose voice is the model: the character who taught the line. */
  speakerId?: string;
  practice?: PracticeClient;
  /** The microphone and the backend's pronunciation check are both available. */
  canPractise: boolean;
  onHear: (text: string, rate: SpeechRate) => void;
  onDone: () => void;
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
        <span
          key={`${word.index}-${word.word}`}
          className={!word.scored ? "word-unscored" : word.needsPractice ? "word-practise" : "word-clear"}
        >
          {word.word}
        </span>
      ))}
    </p>
  );
}

/**
 * Pronunciation practice on the lines Sophie just taught: listen, say it, work on
 * the word that needs it most, then the whole line once more. Every attempt is
 * finite, the learner can always move on, and nothing here decides progress.
 */
export function Practice({ lines, excluded, languageCode, speakerId, practice, canPractise, onHear, onDone }: Props) {
  const [state, setState] = useState(startPractice);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const recording = useRef<Recording | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  const turn = useRef(0);
  const texts = lines.map((line) => line.text);
  const target = practiceTarget(state, texts);
  const line = lines[state.lineIndex];

  const abandon = () => {
    turn.current++;
    recording.current?.cancel();
    recording.current = undefined;
    request.current?.abort();
  };
  useEffect(() => abandon, []);

  // Each new line or word is heard first.
  const targetKey = target ? `${state.lineIndex}:${target.mode}:${target.text}` : "done";
  useEffect(() => {
    if (target && canPractise) onHear(target.text, "normal");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(() => {
    if (state.done) onDone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  if (!canPractise) {
    return (
      <div className="practice">
        <p className="turn-prompt">Listen to each line and say it aloud.</p>
        <ol className="practice-list">
          {lines.map((item) => (
            <li key={item.text}>
              <button className="assist-chip" onClick={() => onHear(item.text, "normal")} aria-label={`Hear: ${item.text}`}>▶</button>
              <span>
                <span className="target-language small" lang={languageCode}>{item.text}</span>
                {item.translation && <small>{item.translation}</small>}
              </span>
            </li>
          ))}
        </ol>
        <p className="field-note">Pronunciation feedback isn't available right now.</p>
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
      const result = await practice.attempt({ audio: clip, text: target.text, languageCode, speakerId, excluded, signal: controller.signal });
      if (current !== turn.current) return;
      setStatus({ kind: "idle" });
      setState((previous) => recordAttempt(previous, result, lines.length));
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
    stopVoice();
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

  return (
    <div className="practice">
      <p className="eyebrow practice-step">
        {target.mode === "word" ? "Practise this word" : `Line ${state.lineIndex + 1} of ${lines.length}`}
        {state.finalPhrase && target.mode === "phrase" ? " · once more" : ""}
      </p>
      {state.feedback && (
        <div className="practice-feedback" role="status">
          {state.lastWords && state.lastWords.length > 0 && <WordMarks words={state.lastWords} languageCode={languageCode} />}
          <p>{feedbackText(state.feedback)}</p>
        </div>
      )}
      <p className="target-language" lang={languageCode}>{target.text}</p>
      {target.mode === "phrase" && line?.translation && <p className="translation">{line.translation}</p>}
      {target.guide && <p className="hint-text">Sounds like: <strong>{target.guide}</strong></p>}

      <div className="assist-row">
        <button className="assist-chip" onClick={() => onHear(target.text, "normal")} disabled={recordingNow}>Listen</button>
        <button className="assist-chip" onClick={() => onHear(target.text, "slow")} disabled={recordingNow}>Slower</button>
      </div>

      {status.kind === "error" && status.fatal ? (
        <div className="speech-control">
          <p className="speech-status" role="status">{status.message}</p>
          <button className="primary-pill" onClick={onDone}>Continue</button>
        </div>
      ) : (
        <div className="speech-control" role="group" aria-label="Say it">
          <button
            className={`mic-button${recordingNow ? " recording" : ""}`}
            onClick={() => (recordingNow ? void finish() : void begin())}
            disabled={checking}
            aria-label={recordingNow ? "Finish speaking" : "Say it"}
          >
            <img src={recordingNow ? icons.stop : icons.microphone} alt="" />
          </button>
          <p className="speech-status" role="status">
            {status.kind === "error" ? status.message
              : recordingNow ? "Listening… tap when you've finished."
              : checking ? "Listening back…"
              : "Tap and say it."}
          </p>
        </div>
      )}

      <div className="practice-actions">
        <button className="text-button" onClick={() => { abandon(); setStatus({ kind: "idle" }); setState((previous) => skipLine(previous, lines.length)); }}>
          {state.lineIndex + 1 < lines.length ? "Skip this line" : "Finish"}
        </button>
        <button className="text-button" onClick={() => { abandon(); onDone(); }}>Stop practising</button>
      </div>
    </div>
  );
}
