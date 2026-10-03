import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { resolveConversationVisual } from "../../characters/resolve";
import type { PlayerProfile } from "../../core/models";
import { DISPLAY_NAME_MAX_LENGTH, sanitizeDisplayName } from "../../core/player";
import { sessionLine, suggestionsUnlocked, type DialogueInput, type DialogueSession, type HistoryLine } from "../../dialogue/engine";
import { PLAYER_SPEAKER_ID, type Dialogue, type DialogueNode } from "../../dialogue/models";
import { resolveDialogueLine, resolveTemplate, type ResolvedLine, type ResolvedText, type SlotValues } from "../../dialogue/template";
import type { AssistanceKind, SupportLevel } from "../../learning/models";
import { supportPolicy } from "../../learning/support";
import type { PracticeClient } from "../../speech/httpPractice";
import type { AudioClip, SpeechCapability } from "../../speech/types";
import type { VoiceLibrary } from "../../speech/voiceLibrary";
import { SHOW_NEXT_BUTTON } from "../flags";
import { useKeyboardInset, useSpeakingPulse } from "../hooks";
import { icons } from "../icons";
import { useLineVoice, useSpeaker, type AudioSettings, type LineVoice, type SpeakerState, type SpokenItem } from "../voice";
import { traceText } from "./TracedText";
import { CharacterPortrait } from "./CharacterPortrait";
import { Practice } from "./Practice";
import { SAID_LABEL, SaidText, saidSummary } from "./Said";
import { SoundSettings } from "./SoundSettings";
import { SpeechControl } from "./SpeechControl";

export interface ConversationSpeaker {
  name: string;
  /** Character visual ID, when the speaker may have a close-up portrait. */
  characterId?: string;
}

/** A line the player could say, already resolved and checked against the intent. */
export interface SayChoice {
  id: string;
  text: string;
  translation?: string;
  fits: boolean;
}

type Props = {
  dialogue: Dialogue;
  /** The engine's state. This component renders it and reports inputs; it decides nothing. */
  session: DialogueSession;
  languageCode: string;
  /** The learner's own language, for lines marked `language: "interface"`. */
  interfaceLanguageCode: string;
  speakers: Record<string, ConversationSpeaker>;
  slotValues: SlotValues;
  profile: PlayerProfile;
  supportLevel: SupportLevel;
  speech: SpeechCapability;
  /** Turns a recording into words. Needed only when `speech` is available. */
  transcribe?: (clip: AudioClip, signal: AbortSignal) => Promise<{ transcript: string; speechDetected: boolean }>;
  /** Suggestions for the current line when it is the player's turn to speak. */
  sayChoices: SayChoice[];
  /** Voiced lines, when a backend is configured. Without it conversations are silent. */
  voiceLibrary?: VoiceLibrary;
  audioSettings: AudioSettings;
  onAudioSettingsChange: (change: Partial<AudioSettings>) => void;
  /** The learner's answer is being considered; nothing more can be said until it is. */
  thinking?: boolean;
  /** Pronunciation practice through the backend, when it can hear and compare. */
  practice?: PracticeClient;
  practiceAvailable: boolean;
  onInput: (input: DialogueInput) => void;
  onExit: () => void;
};

/** Shown on the line that follows the player's answer: what was taken in, and how it went. */
function SaidFeedback({ line, languageCode }: { line: HistoryLine; languageCode: string }) {
  const summary = saidSummary(line);
  return (
    <div className={`said-feedback${line.said?.communicated === false ? " missed" : ""}`}>
      <p className="heard-note">{SAID_LABEL[line.said?.mode ?? "typed"]}: “<SaidText line={line} languageCode={languageCode} />”</p>
      {summary && <p className="said-summary">{summary}</p>}
      {line.rewording && <p className="said-summary">You could also say: <span lang={languageCode}>“{line.rewording}”</span></p>}
    </div>
  );
}

/** Render resolved text, underlining spans that assessment will not grade. */
function renderText(resolved: ResolvedText, markUnscored: boolean) {
  const unscored = markUnscored ? resolved.spans.filter((span) => !span.scored) : [];
  if (!unscored.length) return resolved.text;
  const parts = [];
  let cursor = 0;
  for (const span of unscored) {
    parts.push(resolved.text.slice(cursor, span.start));
    parts.push(<span key={span.start} className="unscored">{resolved.text.slice(span.start, span.end)}</span>);
    cursor = span.end;
  }
  parts.push(resolved.text.slice(cursor));
  return parts;
}

type LineProps = Pick<Props, "languageCode" | "profile" | "supportLevel" | "speech" | "transcribe" | "sayChoices" | "thinking" | "onInput" | "slotValues" | "practice" | "practiceAvailable"> & {
  /** The language this line is written in: the target language, or the learner's own. */
  lineLanguage: string;
  /** Who taught the line being practised; their voice is the model. */
  partnerId?: string;
  interfaceLanguageCode: string;
  speaking: SpeakerState | null;
  speak: (items: SpokenItem[]) => Promise<void>;
  /** Move on by itself once the line has been heard or read. */
  autoAdvance: boolean;
  node: DialogueNode;
  /** The words of this line: scripted, or the speaker's reaction to what was said. */
  line: ResolvedLine;
  /** The player's answer just before this line, shown back with how it went. */
  lastSaid?: HistoryLine;
  /** Who the player is talking to, for the moment their answer is being considered. */
  partnerName?: string;
  voice: LineVoice;
  /** Show the written line while it is spoken. */
  subtitles: boolean;
  speakerName: string;
  /** The player has missed this question often enough to simply be offered what fits. */
  offerAnswers: boolean;
  retrying: boolean;
};

/** One line of dialogue. Keyed by node and attempt, so assistance state resets each time. */
function DialogueLine(props: LineProps) {
  const { node, line, speakerName, partnerName, languageCode, lineLanguage, profile, supportLevel, speech, transcribe, sayChoices, offerAnswers, retrying, voice, subtitles, lastSaid, thinking, onInput } = props;
  const policy = supportPolicy(supportLevel);
  const response = node.response;
  const isSay = response?.kind === "say";

  const [translationRevealed, setTranslationRevealed] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [replayed, setReplayed] = useState(false);
  const [slowed, setSlowed] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const [text, setText] = useState(response?.kind === "text" ? profile[response.saveTo] ?? "" : "");

  // On the player's turn the target text is a model answer: shown outright only with full support.
  const modelVisible = !isSay || policy.translation === "visible" || answerRevealed || offerAnswers;
  // Listening first: a spoken line keeps its text back until asked. Silence always shows the text.
  const voiced = !isSay && (voice.status === "loading" || voice.status === "playing" || voice.status === "finished");
  const textHidden = voiced && !subtitles && !textRevealed;
  const translationVisible = modelVisible && !textHidden && Boolean(line.translation) && (policy.translation === "visible" || translationRevealed);
  const canRevealTranslation = modelVisible && !textHidden && Boolean(line.translation) && !translationVisible
    && (policy.translation === "on-request" || helpOpen);
  // On the player's turn a hint is only useful while the model answer is still hidden.
  const canRevealHint = Boolean(node.hint) && !hintRevealed && (!isSay || !modelVisible) && (policy.hints === "offered" || helpOpen);
  const canRevealAnswer = isSay && !modelVisible && (policy.hints === "offered" || helpOpen);
  const needsHelpButton = !helpOpen && policy.hints === "on-help" && (
    (Boolean(line.translation) && modelVisible && !translationVisible) || (Boolean(node.hint) && !hintRevealed) || (isSay && !modelVisible)
  );

  const assistance = (extra: AssistanceKind[] = []): AssistanceKind[] => {
    const used = new Set<AssistanceKind>(extra);
    if (translationVisible) used.add("translation");
    if (hintRevealed) used.add("hint");
    if (replayed) used.add("replay");
    if (slowed) used.add("slow-playback");
    if (isSay && modelVisible) used.add("suggested-answer");
    return [...used];
  };

  /** What the engine needs to tell listening from reading. */
  const heardAs = () => ({ heard: !isSay && voice.wasHeard(), textVisible: !textHidden });
  const canHear = voice.canPlay && modelVisible;
  // English lines are recordings or plain prompts; "Slower" is for the language being learned.
  const canSlow = canHear && node.language !== "interface";

  // A line with nothing to answer moves on once it has been heard, or read in silence.
  useEffect(() => {
    if (!props.autoAdvance || response || thinking) return;
    const silent = voice.status === "off" || voice.status === "unavailable";
    if (voice.status !== "finished" && !silent) return;
    const readingTime = silent ? Math.max(1800, line.target.text.length * 55) : 700;
    const timer = window.setTimeout(() => onInput({ type: "CONTINUE", assistance: assistance(), ...heardAs() }), readingTime);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoAdvance, voice.status, node.id]);

  // While the line is spoken, the words light up as they are said.
  const tracing = voice.status === "playing" && !isSay;

  const submitProfileText = (event: FormEvent) => {
    event.preventDefault();
    if (response?.kind === "text" && sanitizeDisplayName(text)) onInput({ type: "ANSWER", value: text, assistance: assistance(), ...heardAs() });
  };

  const submitSaid = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) onInput({ type: "SAY", text, mode: "typed", assistance: assistance() });
  };

  // Suggestions are support, so they appear with full support or once the player is clearly stuck.
  const choices = isSay && (policy.translation === "visible" || offerAnswers)
    ? sayChoices.filter((choice) => choice.fits || !offerAnswers)
    : [];
  const hasUnscored = isSay && modelVisible && line.target.spans.some((span) => !span.scored);

  if (response?.kind === "practice") {
    const target = Object.fromEntries(Object.entries(props.slotValues).map(([name, value]) => [name, value.target]));
    const translation = Object.fromEntries(Object.entries(props.slotValues).map(([name, value]) => [name, value.translation]));
    const lines = response.lines.map((item) => ({
      text: resolveTemplate(item.text, target).text,
      translation: item.translation === undefined ? undefined : resolveTemplate(item.translation, translation).text
    }));
    const excluded = (node.assessment?.excludedSpans ?? []).map((slot) => props.slotValues[slot]?.target).filter((value): value is string => Boolean(value));
    return (
      <section className="dialogue-card" aria-label="Practise saying it">
        <div className="name-chip player">{speakerName}</div>
        <div className="dialogue-scroll">
          <Practice
            lines={lines}
            excluded={excluded}
            languageCode={languageCode}
            interfaceLanguageCode={props.interfaceLanguageCode}
            speakerId={props.partnerId}
            practice={props.practice}
            canPractise={props.practiceAvailable && Boolean(props.practice)}
            speaking={props.speaking}
            speak={props.speak}
            onDone={() => onInput({ type: "PRACTICED", assistance: [] })}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="dialogue-card" aria-label={isSay ? "Your turn" : `${speakerName} says`}>
      <div className={`name-chip${isSay ? " player" : ""}`}>{speakerName}</div>
      {canHear && (
        <button
          className="round-button replay"
          aria-label={isSay ? "Hear the answer" : "Hear it again"}
          onClick={() => { setReplayed(true); voice.play("normal"); }}
        >
          <img src={icons["replay-audio"]} alt="" />
        </button>
      )}

      <div className="dialogue-scroll">
        {lastSaid && <SaidFeedback line={lastSaid} languageCode={languageCode} />}
        {isSay && <p className="turn-prompt">{retrying ? "Try again. " : ""}{response.prompt}</p>}
        {textHidden && <p className="listen-placeholder" role="status">Listen…</p>}
        {modelVisible && !textHidden && (
          <p className="target-language" lang={lineLanguage}>
            {tracing && voice.words ? traceText(line.target.text, voice.words, voice.activeWord) : renderText(line.target, isSay)}
          </p>
        )}
        {translationVisible && line.translation && <p className="translation">{line.translation.text}</p>}
        {hintRevealed && node.hint && <p className="hint-text" lang={languageCode}>{node.hint}</p>}
        {hasUnscored && <p className="assessment-note">Underlined words are yours and aren't graded.</p>}

        {(textHidden || canSlow || canRevealTranslation || canRevealHint || canRevealAnswer || needsHelpButton) && (
          <div className={`assist-row${response ? "" : " beside-next"}`}>
            {textHidden && <button className="assist-chip" onClick={() => setTextRevealed(true)}>Show text</button>}
            {canSlow && (
              <button className="assist-chip" onClick={() => { setSlowed(true); voice.play("slow"); }}>Slower</button>
            )}
            {canRevealTranslation && (
              <button className="assist-chip" onClick={() => setTranslationRevealed(true)}>Show translation</button>
            )}
            {canRevealHint && <button className="assist-chip" onClick={() => setHintRevealed(true)}>Hint</button>}
            {canRevealAnswer && <button className="assist-chip" onClick={() => setAnswerRevealed(true)}>Show an answer</button>}
            {needsHelpButton && <button className="assist-chip" onClick={() => setHelpOpen(true)}>Need help?</button>}
          </div>
        )}

        {response?.kind === "choice" && (
          <div className="choice-list" role="group" aria-label="Your answer">
            {response.options.map((option) => (
              <button
                key={option.value}
                className="choice-pill"
                onClick={() => onInput({ type: "ANSWER", value: option.value, assistance: assistance(), ...heardAs() })}
              >
                {option.icon && icons[option.icon] && <img src={icons[option.icon]} alt="" />}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}

        {response?.kind === "act" && (
          <div className="act-response" role="group" aria-label={response.prompt}>
            <p className="turn-prompt">{retrying ? "Try again. " : ""}{response.prompt}</p>
            <div className="act-options">
              {response.options.filter((option) => option.correct || !offerAnswers).map((option) => (
                <button
                  key={option.id}
                  className="act-pill"
                  onClick={() => onInput({
                    type: "ACT",
                    optionId: option.id,
                    assistance: assistance(offerAnswers ? ["suggested-answer"] : []),
                    ...heardAs()
                  })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {response?.kind === "text" && (
          <form className="text-response" onSubmit={submitProfileText}>
            <label htmlFor={`response-${node.id}`}>{response.label}</label>
            <input
              id={`response-${node.id}`}
              className="text-field"
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={response.placeholder}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoComplete="nickname"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            {response.note && <p className="field-note">{response.note}</p>}
            <button className="primary-pill" type="submit" disabled={!sanitizeDisplayName(text)}>Continue</button>
          </form>
        )}

        {isSay && thinking && (
          <p className="speech-status thinking" role="status">{partnerName ?? "They"} is thinking…</p>
        )}

        {isSay && !thinking && (
          <div className="say-response">
            {speech.available && transcribe && (
              <SpeechControl
                transcribe={transcribe}
                onSaid={(transcript) => onInput({ type: "SAY", text: transcript, mode: "speech", assistance: assistance() })}
              />
            )}
            {choices.length > 0 && (
              <div className="choice-list" role="group" aria-label="Suggestions">
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    className="choice-pill say-choice"
                    lang={languageCode}
                    onClick={() => onInput({ type: "SAY", text: choice.text, mode: "selected", assistance: assistance(["suggested-answer"]) })}
                  >
                    <span>
                      {choice.text}
                      {translationVisible && choice.translation && <small lang="en">{choice.translation}</small>}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <form className="say-form" onSubmit={submitSaid}>
              <label className="visually-hidden" htmlFor={`say-${node.id}`}>Type your answer in French</label>
              <input
                id={`say-${node.id}`}
                className="text-field"
                type="text"
                lang={languageCode}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={speech.available ? "…or type it in French" : "Type it in French…"}
                maxLength={120}
                autoComplete="off"
                autoCapitalize="sentences"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
              />
              <button className="round-button send" type="submit" disabled={!text.trim()} aria-label="Say it">
                <img src={icons.next} alt="" />
              </button>
            </form>
          </div>
        )}
      </div>

      {!response && SHOW_NEXT_BUTTON && (
        <button
          className="round-button next"
          onClick={() => onInput({ type: "CONTINUE", assistance: assistance(), ...heardAs() })}
          aria-label="Next"
        >
          <img src={icons.next} alt="" />
        </button>
      )}
    </section>
  );
}

function History({ lines, speakers, languageCode, showTranslations, onClose }: {
  lines: HistoryLine[];
  speakers: Record<string, ConversationSpeaker>;
  languageCode: string;
  /** Looking back must not hand out translations the support level is withholding. */
  showTranslations: boolean;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Earlier in this conversation" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <h2>Earlier</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <ol className="sheet-body history-list">
          {lines.map((entry, index) => (
            <li key={index} className={entry.speakerId === PLAYER_SPEAKER_ID ? "mine" : undefined}>
              <span className="history-speaker">{speakers[entry.speakerId]?.name ?? entry.speakerId}</span>
              {entry.said ? <SaidText line={entry} languageCode={languageCode} /> : <span lang={languageCode}>{entry.text}</span>}
              {showTranslations && entry.translation && <small>{entry.translation}</small>}
              {entry.said && <small>{saidSummary(entry)}</small>}
              {entry.rewording && <small>You could also say: <span lang={languageCode}>{entry.rewording}</span></small>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function AudioSheet({ settings, available, onChange, onClose }: {
  settings: AudioSettings;
  available: boolean;
  onChange: (change: Partial<AudioSettings>) => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Sound" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <h2>Sound</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close sound settings">×</button>
        </header>
        <div className="sheet-body">
          <SoundSettings settings={settings} available={available} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

/**
 * The focused conversation presentation. It sits over the live world rather than
 * replacing it: the scene stays visible behind a soft scrim, the conversation
 * partner's portrait stands above a bottom dialogue card, and every control is
 * thumb-sized. All progression comes from the dialogue engine.
 */
export function Conversation({ dialogue, session, speakers, voiceLibrary, audioSettings, onAudioSettingsChange, onExit, interfaceLanguageCode, ...lineProps }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const node = dialogue.nodes[session.nodeId];
  const speakerName = speakers[node.speakerId]?.name ?? node.speakerId;
  const partner = session.npcId ? speakers[session.npcId] : undefined;
  const keyboardInset = useKeyboardInset();
  const playerTurn = node.speakerId === PLAYER_SPEAKER_ID;
  const line = sessionLine(session, node, lineProps.slotValues);
  const spoken = line.target.text;
  const lineKey = `${dialogue.id}.${node.id}.${session.history.length}`;
  const languageOf = (item: DialogueNode) => (item.language === "interface" ? interfaceLanguageCode : lineProps.languageCode);
  const lineLanguage = languageOf(node);

  // Character lines are spoken as they appear; the player's model answer only on request.
  const voice = useLineVoice(voiceLibrary, audioSettings, {
    key: lineKey,
    text: spoken,
    languageCode: lineLanguage,
    speakerId: playerTurn ? undefined : node.speakerId,
    autoplay: !playerTurn
  });
  const silent = voice.status === "off" || voice.status === "unavailable";
  // Sequences of prompts and lines, such as during pronunciation practice.
  const speaker = useSpeaker(voiceLibrary, audioSettings);
  // The partner's mouth follows the voice, or a timed flap when there is no sound.
  const flap = useSpeakingPulse(lineKey, spoken, silent && !playerTurn);
  const speaking = speaker.speaking ? speaker.speaking.mouthOpen : !playerTurn && (silent ? flap : voice.mouthOpen);
  const hasPortrait = Boolean(partner?.characterId && resolveConversationVisual({ character: partner.characterId }));
  const failures = session.failedAttempts[node.id] ?? 0;
  // On the line that follows the player's answer, show what was taken in and how it went.
  const lastLine = session.history.at(-1);
  const lastSaid = lastLine?.said ? lastLine : undefined;

  // Have the next character line ready before it is reached. Lines that depend on
  // the answer being given now are left until their words are known.
  const upcoming = node.nextNodeId && !node.response ? dialogue.nodes[node.nextNodeId] : undefined;
  const upcomingText = upcoming && upcoming.speakerId !== PLAYER_SPEAKER_ID
    ? resolveDialogueLine(upcoming, lineProps.slotValues).target.text
    : undefined;
  useEffect(() => {
    if (voiceLibrary && audioSettings.voice && upcoming && upcomingText) {
      voiceLibrary.prefetch({ text: upcomingText, languageCode: languageOf(upcoming), speakerId: upcoming.speakerId, rate: "normal" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceLibrary, audioSettings.voice, upcomingText]);

  return (
    <div className="conversation" style={{ "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}>
      <div className="conversation-tools">
        {session.history.length > 0 && (
          <button onClick={() => setHistoryOpen(true)} aria-label="Earlier in this conversation">
            <span aria-hidden="true">≡</span>
          </button>
        )}
        {voiceLibrary && (
          <button onClick={() => setAudioOpen(true)} aria-label="Sound settings" className={audioSettings.voice ? undefined : "muted"}>
            <img src={icons["replay-audio"]} alt="" />
          </button>
        )}
      </div>
      <button className="conversation-leave" onClick={onExit} aria-label="Leave conversation">×</button>
      <div className="conversation-stage">
        {hasPortrait && partner?.characterId && (
          <CharacterPortrait character={partner.characterId} expression={node.presentation?.expression} speaking={speaking} />
        )}
      </div>
      <div className="conversation-dock">
        <DialogueLine
          key={`${node.id}:${failures}`}
          node={node}
          line={line}
          speakerName={speakerName}
          partnerName={partner?.name}
          offerAnswers={suggestionsUnlocked(session, node.id)}
          retrying={failures > 0}
          voice={voice}
          subtitles={audioSettings.subtitles}
          lastSaid={lastSaid}
          lineLanguage={lineLanguage}
          partnerId={session.npcId}
          interfaceLanguageCode={interfaceLanguageCode}
          speaking={speaker.speaking}
          speak={speaker.speak}
          autoAdvance={!SHOW_NEXT_BUTTON || Boolean(dialogue.autoAdvance)}
          {...lineProps}
        />
      </div>
      {historyOpen && (
        <History
          lines={session.history}
          speakers={speakers}
          languageCode={lineProps.languageCode}
          showTranslations={supportPolicy(lineProps.supportLevel).translation === "visible"}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {audioOpen && (
        <AudioSheet
          settings={audioSettings}
          available={voiceLibrary?.available ?? false}
          onChange={onAudioSettingsChange}
          onClose={() => setAudioOpen(false)}
        />
      )}
    </div>
  );
}
