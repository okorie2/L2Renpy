import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MessageThreadState, NPC } from "../../../core/models";
import { sessionLine, suggestionsUnlocked, type DialogueInput, type HistoryLine } from "../../../dialogue/engine";
import { PLAYER_SPEAKER_ID, type Dialogue, type DialogueNode } from "../../../dialogue/models";
import type { SlotValues } from "../../../dialogue/template";
import type { AssistanceKind, SupportLevel } from "../../../learning/models";
import { supportPolicy } from "../../../learning/support";
import { icons } from "../../icons";
import type { SayChoice } from "../Conversation";
import { SaidText, saidSummary } from "../Said";

/** A received thread with everything needed to show it. */
export interface ThreadEntry {
  id: string;
  contact: NPC;
  dialogue: Dialogue;
  state: MessageThreadState;
}

type ThreadProps = {
  entry: ThreadEntry;
  languageCode: string;
  slotValues: SlotValues;
  supportLevel: SupportLevel;
  playerName: string;
  /** The player's answer is being considered. */
  thinking: boolean;
  sayChoices: (node: DialogueNode) => SayChoice[];
  /** Say a message aloud, when voices are available. */
  onHear?: (text: string, speakerId: string) => void;
  onInput: (input: DialogueInput) => void;
  onRead: () => void;
};

/** How long a message sits before the next one arrives, so a thread reads like one. */
const NEXT_MESSAGE_DELAY_MS = 1100;

/** The last thing said in a thread, for the list. */
export function threadPreview(entry: ThreadEntry, slotValues: SlotValues): string {
  const { session } = entry.state;
  const node = entry.dialogue.nodes[session.nodeId];
  if (session.status === "active" && node && node.speakerId !== PLAYER_SPEAKER_ID) return sessionLine(session, node, slotValues).target.text;
  return session.history.at(-1)?.text ?? "";
}

/**
 * One conversation, as messages. It is the same dialogue engine as a face-to-face
 * conversation: this view only draws the session and reports what the player wrote.
 */
export function MessageThreadView({ entry, languageCode, slotValues, supportLevel, playerName, thinking, sayChoices, onHear, onInput, onRead }: ThreadProps) {
  const { dialogue, contact, state } = entry;
  const session = state.session;
  const node = session.status === "active" ? dialogue.nodes[session.nodeId] : undefined;
  const response = node?.response;
  const policy = supportPolicy(supportLevel);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  // Whether a translation was looked at since the player last answered.
  const [usedTranslation, setUsedTranslation] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [answersShown, setAnswersShown] = useState(false);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);

  // Having the thread open is what reading it means.
  useEffect(() => { if (state.unread) onRead(); });

  const translationHelp: AssistanceKind[] = policy.translation === "visible" || usedTranslation ? ["translation"] : [];

  // Lines from the other person arrive one after another, without the player asking for each.
  const waiting = node !== undefined && !response && !thinking;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => onInput({ type: "CONTINUE", assistance: translationHelp }), NEXT_MESSAGE_DELAY_MS);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, session.nodeId, session.history.length]);

  // What is on screen: everything passed, then the line that has just arrived.
  const lines: HistoryLine[] = [...session.history];
  if (node && node.speakerId !== PLAYER_SPEAKER_ID) {
    const line = sessionLine(session, node, slotValues);
    lines.push({ nodeId: node.id, speakerId: node.speakerId, text: line.target.text, translation: line.translation?.text });
  }

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines.length, thinking, response?.kind]);

  const isSay = response?.kind === "say";
  const offerAnswers = node ? suggestionsUnlocked(session, node.id) : false;
  const suggestionsVisible = isSay && (policy.translation === "visible" || answersShown || offerAnswers);
  const choices = suggestionsVisible && node ? sayChoices(node).filter((choice) => choice.fits || !offerAnswers) : [];
  const assistance = (extra: AssistanceKind[] = []): AssistanceKind[] => [...new Set<AssistanceKind>([
    ...extra, ...translationHelp, ...(hintShown ? ["hint" as const] : []), ...(suggestionsVisible ? ["suggested-answer" as const] : [])
  ])];
  const send = (input: DialogueInput) => {
    setText("");
    setUsedTranslation(false);
    setHintShown(false);
    setAnswersShown(false);
    onInput(input);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) send({ type: "SAY", text, mode: "typed", assistance: assistance() });
  };

  return (
    <div className="thread">
      <ol className="thread-lines" aria-label={`Messages with ${contact.name}`}>
        {lines.map((line, index) => {
          const mine = line.speakerId === PLAYER_SPEAKER_ID;
          const summary = mine ? saidSummary(line) : undefined;
          const translated = !mine && Boolean(line.translation) && (policy.translation === "visible" || revealed.has(index));
          return (
            <li key={index} className={mine ? "mine" : undefined}>
              <span className="visually-hidden">{mine ? playerName : contact.name}: </span>
              <div className={`bubble${line.said?.communicated === false ? " missed" : ""}`}>
                {mine ? <SaidText line={line} languageCode={languageCode} /> : <span lang={languageCode}>{line.text}</span>}
                {translated && <small>{line.translation}</small>}
              </div>
              {!mine && (
                <div className="bubble-tools">
                  {onHear && (
                    <button onClick={() => onHear(line.text, line.speakerId)} aria-label="Hear this message">
                      <img src={icons["replay-audio"]} alt="" />
                    </button>
                  )}
                  {line.translation && !translated && (
                    <button
                      onClick={() => {
                        setRevealed((current) => new Set(current).add(index));
                        setUsedTranslation(true);
                      }}
                    >
                      Translate
                    </button>
                  )}
                </div>
              )}
              {summary && <small className="bubble-note">{summary}</small>}
              {line.rewording && <small className="bubble-note">You could also say: <span lang={languageCode}>“{line.rewording}”</span></small>}
            </li>
          );
        })}
        {thinking && <li><div className="bubble typing" role="status">{contact.name} is typing…</div></li>}
      </ol>

      {isSay && node && !thinking && (
        <div className="thread-composer">
          <p className="turn-prompt">{(session.failedAttempts[node.id] ?? 0) > 0 ? "Try again. " : ""}{response.prompt}</p>
          {hintShown && node.hint && <p className="hint-text" lang={languageCode}>{node.hint}</p>}
          {choices.length > 0 && (
            <div className="choice-list" role="group" aria-label="Suggestions">
              {choices.map((choice) => (
                <button
                  key={choice.id}
                  className="choice-pill say-choice"
                  lang={languageCode}
                  onClick={() => send({ type: "SAY", text: choice.text, mode: "selected", assistance: assistance(["suggested-answer"]) })}
                >
                  <span>
                    {choice.text}
                    {policy.translation === "visible" && choice.translation && <small lang="en">{choice.translation}</small>}
                  </span>
                </button>
              ))}
            </div>
          )}
          {(!suggestionsVisible || (node.hint && !hintShown)) && (
            <div className="assist-row">
              {node.hint && !hintShown && <button className="assist-chip" onClick={() => setHintShown(true)}>Hint</button>}
              {!suggestionsVisible && <button className="assist-chip" onClick={() => setAnswersShown(true)}>Show answers</button>}
            </div>
          )}
          <form className="say-form" onSubmit={submit}>
            <label className="visually-hidden" htmlFor={`message-${node.id}`}>Write your message in French</label>
            <input
              id={`message-${node.id}`}
              className="text-field"
              type="text"
              lang={languageCode}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write in French…"
              maxLength={120}
              autoComplete="off"
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
            />
            <button className="round-button send" type="submit" disabled={!text.trim()} aria-label="Send">
              <img src={icons.next} alt="" />
            </button>
          </form>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
