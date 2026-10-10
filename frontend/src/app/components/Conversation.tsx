import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { resolveConversationVisual } from "../../characters/resolve";
import type { CharacterExpression } from "../../characters/types";
import type { PlayerProfile } from "../../core/models";
import { DISPLAY_NAME_MAX_LENGTH, sanitizeAge, sanitizeDisplayName } from "../../core/player";
import { sessionLine, suggestionsUnlocked, type DialogueInput, type DialogueSession, type HistoryLine } from "../../dialogue/engine";
import { PLAYER_SPEAKER_ID, type Dialogue, type DialogueNode } from "../../dialogue/models";
import { resolveDialogueLine, resolveTemplate, type ResolvedLine, type ResolvedText, type SlotValues } from "../../dialogue/template";
import type { AssistanceKind, PronunciationDiagnostics, SupportLevel } from "../../learning/models";
import { supportPolicy } from "../../learning/support";
import type { PracticeClient } from "../../speech/httpPractice";
import { answerFeedbackKind, createPhrasePicker, type PracticeResult } from "../../speech/practice";
import type { AudioClip, SpeechCapability } from "../../speech/types";
import type { VoiceLibrary } from "../../speech/voiceLibrary";
import { SHOW_NEXT_BUTTON } from "../flags";
import { useKeyboardInset, useSpeakingPulse } from "../hooks";
import { icons } from "../icons";
import { useLineVoice, useSpeaker, type AudioSettings, type LineVoice, type SpeakerState, type SpokenItem } from "../voice";
import { traceText } from "./TracedText";
import { CharacterPortrait } from "./CharacterPortrait";
import { Practice } from "./Practice";
import { StreetStage, WalkInterlude } from "./WalkInterlude";
import { streetCamera, streetPeople } from "../../content/scenes";
import { SAID_LABEL, SaidText, saidSummary } from "./Said";
import { SoundSettings } from "./SoundSettings";
import { pronunciationNote, SpeechControl } from "./SpeechControl";
import { TypeInstead } from "./TypeInstead";

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
  /** Whether a spoken answer will be understood, asked before it is sent so the card can react first. */
  checkSaid?: (input: DialogueInput) => Promise<{ understood: boolean; input: DialogueInput }>;
  /** Back to the previous card, which plays again. Absent on the first card. */
  onBack?: () => void;
  /** Open the scene menu, to play a part of the story again. */
  onOpenScenes?: () => void;
  /** Forward again through cards already seen. Absent at the furthest card reached. */
  onForward?: () => void;
  /** Behind the furthest card: answers here are practice and are not recorded. */
  replaying?: boolean;
  onExit: () => void;
};

/** Shown on the line that follows the player's answer: what was taken in, and how it went. */
function SaidFeedback({ line, languageCode }: { line: HistoryLine; languageCode: string }) {
  const summary = saidSummary(line);
  return (
    <div className={`said-feedback${line.said?.communicated === false ? " missed" : ""}`}>
      <p className="heard-note">{SAID_LABEL[line.said?.mode ?? "typed"]}: “<SaidText line={line} languageCode={languageCode} />”</p>
      {summary && <p className="said-summary">{summary}</p>}
      {pronunciationNote(line.said?.pronunciation) && <p className="said-summary">{pronunciationNote(line.said?.pronunciation)}</p>}
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

type LineProps = Pick<Props, "languageCode" | "profile" | "supportLevel" | "speech" | "transcribe" | "sayChoices" | "thinking" | "onInput" | "checkSaid" | "slotValues" | "practice" | "practiceAvailable"> & {
  /** The language this line is written in: the target language, or the learner's own. */
  lineLanguage: string;
  /** Who taught the line being practised; their voice is the model. */
  partnerId?: string;
  /** On a speaking card: the name of whoever asks the question on it. */
  askerName?: string;
  interfaceLanguageCode: string;
  speaking: SpeakerState | null;
  speak: (items: SpokenItem[]) => Promise<void>;
  /** Move on by itself once the line has been heard or read. */
  autoAdvance: boolean;
  /** Held by the learner: nothing plays and nothing moves on. */
  paused: boolean;
  /** The card's own control: pause or play. */
  controls: ReactNode;
  /** How this card was reached, for the way it slides in. */
  arrival?: "back" | "forward";
  /** During practice: the gesture Sophie should show for what she is saying. */
  onExpression: (expression: CharacterExpression) => void;
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
  const response = props.node.response;
  return response?.kind === "say" && response.speakOnly ? <SpeakLine {...props} /> : <StandardLine {...props} />;
}

/** Sophie's reaction to an understood answer stays readable at least this long. */
const FEEDBACK_MIN_MS = 1600;
/** A short pause after she finishes, before the card goes. */
const FEEDBACK_AFTER_MS = 500;
/** An answer that wasn't understood is shown briefly before being asked again. */
const MISSED_HOLD_MS = 1200;
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** How long the English waits after the French, when it follows "after a beat". */
const TRANSLATION_BEAT_MS = 500;
const SILENT_TRANSLATION_BEAT_MS = 1600;

/** What the pronunciation check found, in the form kept with the learner's progress. */
function diagnosticsOf(result: PracticeResult): PronunciationDiagnostics {
  return {
    wordsNeedingPractice: result.words.filter((word) => word.scored && word.needsPractice).map((word) => ({ word: word.word })),
    ...(result.similarity === null ? {} : { phraseRelativeSimilarity: result.similarity })
  };
}

/**
 * A speaking card: the question is asked aloud on the card, and the learner answers
 * into the microphone. Assist has the partner say the answer to repeat. Nothing moves
 * on until the answer is understood; each spoken answer is also scored for
 * pronunciation, shown, and kept with the attempt. Typing appears only if the
 * microphone can't be used.
 */
function SpeakLine(props: LineProps) {
  const { node, line, languageCode, speech, transcribe, voice, lastSaid, thinking, onInput, retrying, partnerId, partnerName } = props;
  const response = node.response as Extract<NonNullable<DialogueNode["response"]>, { kind: "say" }>;
  const question = response.question;
  const timing = node.presentation?.translation;

  const [assisted, setAssisted] = useState(false);
  const [replayed, setReplayed] = useState(false);
  const [translationAsked, setTranslationAsked] = useState(false);
  const [micFailed, setMicFailed] = useState(false);
  /** The answer just given, and Sophie's reaction once it is known to be understood. */
  const [heard, setHeard] = useState<{ transcript: string; pronunciation?: PronunciationDiagnostics; phrase?: string } | undefined>(undefined);
  const [pickPhrase] = useState(() => createPhrasePicker());
  const alive = useRef(true);
  useEffect(() => {
    // StrictMode runs setup again after its development cleanup.
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // The question's English: after a beat on first hearing, behind a tap once it is known.
  const silent = voice.status === "off" || voice.status === "unavailable";
  const [beatPassed, setBeatPassed] = useState(timing !== "delayed");
  useEffect(() => {
    if (beatPassed || props.paused) return;
    if (voice.status !== "finished" && !silent) return;
    const timer = window.setTimeout(() => setBeatPassed(true), silent ? SILENT_TRANSLATION_BEAT_MS : TRANSLATION_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [beatPassed, voice.status, props.paused, silent]);
  // The English shows, except on a quiz, test or exercise, where it waits for a tap.
  const translationOnRequest = Boolean(node.presentation?.exercise);
  const questionTranslationShown = Boolean(question?.translation) && (translationAsked || (!translationOnRequest && beatPassed));

  const assistance = (): AssistanceKind[] => {
    const used: AssistanceKind[] = [];
    if (assisted) used.push("suggested-answer");
    if (replayed) used.push("replay");
    if (translationAsked) used.push("translation");
    return used;
  };

  const assist = () => {
    setAssisted(true);
    void props.speak([{ text: line.target.text, languageCode, speakerId: partnerId }]);
  };

  const excluded = (node.assessment?.excludedSpans ?? []).map((slot) => props.slotValues[slot]?.target).filter((value): value is string => Boolean(value));
  const assess = props.practice && props.practiceAvailable
    ? (clip: AudioClip, signal: AbortSignal) => props.practice!.attempt({ audio: clip, text: line.target.text, languageCode, speakerId: partnerId, excluded, signal }).then(diagnosticsOf)
    : undefined;
  const canSpeak = speech.available && Boolean(transcribe) && !micFailed;

  /**
   * An answer: if it will be understood, Sophie reacts to it out loud, with the
   * card still up so her words can be read, and only then does the conversation
   * move on. If not, the conversation asks again straight away.
   */
  const answer = async (said: string, mode: "speech" | "typed", pronunciation?: PronunciationDiagnostics) => {
    const input: DialogueInput = { type: "SAY", text: said, mode, assistance: assistance(), ...(pronunciation ? { pronunciation } : {}) };
    setHeard({ transcript: said, pronunciation });
    const checked = props.checkSaid ? await props.checkSaid(input) : { understood: false, input };
    if (!alive.current) return;
    if (!checked.understood) {
      await wait(MISSED_HOLD_MS);
      if (alive.current) onInput(checked.input);
      return;
    }
    const phrase = pickPhrase(answerFeedbackKind(pronunciation?.phraseRelativeSimilarity));
    setHeard({ transcript: said, pronunciation, phrase });
    const started = Date.now();
    await props.speak([{ text: phrase, languageCode: props.interfaceLanguageCode, speakerId: partnerId }]);
    // Silent, or very quick: still long enough to read.
    await wait(Math.max(FEEDBACK_AFTER_MS, FEEDBACK_MIN_MS - (Date.now() - started)));
    if (alive.current) onInput(checked.input);
  };


  return (
    <section className={`dialogue-card speak-card has-controls${props.arrival ? ` arrived-${props.arrival}` : ""}`} aria-label="Answer out loud">
      <div className="name-chip">{props.askerName ?? partnerName ?? props.speakerName}</div>
      {voice.canPlay && question && (
        <button className="round-button replay" aria-label="Hear it again" onClick={() => { setReplayed(true); voice.play("normal"); }}>
          <img src={icons["replay-audio"]} alt="" />
        </button>
      )}
      <div className="dialogue-scroll speak-layout">
        {lastSaid && <SaidFeedback line={lastSaid} languageCode={languageCode} />}

        {question && (
          <div className="qa-group">
            <p className="target-language" lang={languageCode}>{question.text}</p>
            {questionTranslationShown && question.translation && <p className="translation">{question.translation}</p>}
          </div>
        )}

        {assisted && (
          <div className="qa-group qa-answer">
            <p className="target-language small" lang={languageCode}>{line.target.text}</p>
            {line.translation && <p className="translation">{line.translation.text}</p>}
          </div>
        )}

        <div className="assist-row">
          {question?.translation && !questionTranslationShown && translationOnRequest && (
            <button className="assist-chip" onClick={() => setTranslationAsked(true)} disabled={Boolean(heard)}>Show translation</button>
          )}
          <button className="assist-chip" onClick={assist} disabled={thinking || Boolean(heard)}>{assisted ? "Hear the answer again" : "Assist"}</button>
        </div>

        <div className="speak-action">
          {heard ? (
            <div className="answer-feedback" role="status">
              {heard.phrase && <p className="feedback-phrase">{heard.phrase}</p>}
              <p className="heard-note">You said: “<span lang={languageCode}>{heard.transcript}</span>”</p>
              {heard.phrase && pronunciationNote(heard.pronunciation) && <p className="said-summary">{pronunciationNote(heard.pronunciation)}</p>}
              {!heard.phrase && <p className="speech-status">{thinking ? `${partnerName ?? "They"} is thinking…` : "Just a moment…"}</p>}
            </div>
          ) : (
            <>
              <p className="speak-prompt">{retrying ? "Try again. " : ""}{response.prompt}</p>

              {thinking && <p className="speech-status thinking" role="status">{partnerName ?? "They"} is thinking…</p>}

              {!thinking && canSpeak && transcribe && (
                <SpeechControl
                  transcribe={transcribe}
                  assess={assess}
                  onUnavailable={() => setMicFailed(true)}
                  onSaid={(transcript, pronunciation) => void answer(transcript, "speech", pronunciation)}
                />
              )}

              {!thinking && !canSpeak && (
                <TypeInstead id={node.id} languageCode={languageCode} disabled={Boolean(heard)} onSubmit={(typed) => { if (!heard) void answer(typed, "typed"); }} />
              )}
            </>
          )}
        </div>
      </div>
      {props.controls}
    </section>
  );
}

function StandardLine(props: LineProps) {
  const { node, line, speakerName, partnerName, languageCode, lineLanguage, profile, supportLevel, speech, transcribe, sayChoices, offerAnswers, retrying, voice, subtitles, lastSaid, thinking, onInput } = props;
  const response = node.response;
  const isSay = response?.kind === "say";
  // A question met before keeps its English behind a tap, even where the level would show it.
  const levelPolicy = supportPolicy(supportLevel);
  const translationTiming = node.presentation?.translation;
  // The English shows on every card, except a quiz, test or exercise, where it waits for a tap.
  const policy = { ...levelPolicy, translation: node.presentation?.exercise ? "on-request" as const : "visible" as const };

  const [translationRevealed, setTranslationRevealed] = useState(false);
  const [micFailed, setMicFailed] = useState(false);
  const canSpeak = speech.available && Boolean(transcribe) && !micFailed;
  const [hintRevealed, setHintRevealed] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [replayed, setReplayed] = useState(false);
  const [slowed, setSlowed] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const [text, setText] = useState(response?.kind === "text" ? String(profile[response.saveTo] ?? "") : "");
  const validProfileText = (value: string) => (
    response?.kind === "text" && (response.saveTo === "age" ? sanitizeAge(value) !== undefined : Boolean(sanitizeDisplayName(value)))
  );

  // On the player's turn the target text is a model answer: shown outright only with full support.
  const modelVisible = !isSay || policy.translation === "visible" || answerRevealed || offerAnswers;
  // Listening first: a spoken line keeps its text back until asked. Silence always shows the text.
  const voiced = !isSay && (voice.status === "loading" || voice.status === "playing" || voice.status === "finished");
  const textHidden = voiced && !subtitles && !textRevealed;
  // A question heard for the first time: the French first, then after a beat its meaning.
  const delayTranslation = translationTiming === "delayed" && policy.translation === "visible" && !isSay;
  const [beatPassed, setBeatPassed] = useState(!delayTranslation);
  useEffect(() => {
    if (beatPassed || props.paused) return;
    const silent = voice.status === "off" || voice.status === "unavailable";
    if (voice.status !== "finished" && !silent) return;
    const timer = window.setTimeout(() => setBeatPassed(true), silent ? 1600 : 500);
    return () => window.clearTimeout(timer);
  }, [beatPassed, voice.status, props.paused]);
  const translationVisible = modelVisible && !textHidden && Boolean(line.translation)
    && ((policy.translation === "visible" && beatPassed) || translationRevealed);
  const canRevealTranslation = modelVisible && !textHidden && Boolean(line.translation) && !translationVisible
    && beatPassed && (policy.translation === "on-request" || helpOpen);
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
    if (!props.autoAdvance || response || thinking || props.paused) return;
    const silent = voice.status === "off" || voice.status === "unavailable";
    if (voice.status !== "finished" && !silent) return;
    // A delayed translation gets time to be read once it appears.
    const readingTime = (silent ? Math.max(1800, line.target.text.length * 55) : 700) + (delayTranslation ? 2200 : 0);
    const timer = window.setTimeout(() => onInput({ type: "CONTINUE", assistance: assistance(), ...heardAs() }), readingTime);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoAdvance, voice.status, node.id, props.paused]);

  // While the line is spoken, the words light up as they are said.
  const tracing = (voice.status === "playing" || voice.status === "paused") && !isSay;

  const submitProfileText = (event: FormEvent) => {
    event.preventDefault();
    if (response?.kind === "text" && validProfileText(text)) onInput({ type: "ANSWER", value: text, assistance: assistance(), ...heardAs() });
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
      <section className={`dialogue-card has-controls${props.arrival ? ` arrived-${props.arrival}` : ""}`} aria-label="Practise saying it">
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
            onExpression={props.onExpression}
          />
        </div>
        {props.controls}
      </section>
    );
  }

  return (
    <section className={`dialogue-card has-controls${props.arrival ? ` arrived-${props.arrival}` : ""}`} aria-label={isSay ? "Your turn" : `${speakerName} says`}>
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
              inputMode={response.inputMode ?? "text"}
              pattern={response.inputMode === "numeric" ? "[0-9]*" : undefined}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={response.placeholder}
              maxLength={response.saveTo === "age" ? 3 : DISPLAY_NAME_MAX_LENGTH}
              autoComplete={response.saveTo === "age" ? "off" : "nickname"}
              autoCapitalize={response.saveTo === "age" ? "off" : "words"}
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            {response.note && <p className="field-note">{response.note}</p>}
            <button className="primary-pill" type="submit" disabled={!validProfileText(text)}>Continue</button>
          </form>
        )}

        {response?.kind === "continue" && (
          <button
            className="primary-pill continue-pill"
            onClick={() => onInput({ type: "CONTINUE", assistance: assistance(), ...heardAs() })}
          >
            {response.label}
          </button>
        )}

        {isSay && thinking && (
          <p className="speech-status thinking" role="status">{partnerName ?? "They"} is thinking…</p>
        )}

        {isSay && !thinking && (
          <div className="say-response">
            {canSpeak && transcribe && (
              <SpeechControl
                transcribe={transcribe}
                onUnavailable={() => setMicFailed(true)}
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
            {!canSpeak && (
              <TypeInstead id={node.id} languageCode={languageCode} onSubmit={(typed) => onInput({ type: "SAY", text: typed, mode: "typed", assistance: assistance() })} />
            )}
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
      {props.controls}
    </section>
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
export function Conversation({ dialogue, session, speakers, voiceLibrary, audioSettings, onAudioSettingsChange, onBack, onForward, onOpenScenes, replaying, onExit, interfaceLanguageCode, onInput, ...lineProps }: Props) {
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
  // On a speaking card the question is asked aloud on the card itself, by whoever asks it.
  const ask = node.response?.kind === "say" ? node.response.question : undefined;
  const askedBy = ask ? ask.speakerId ?? session.npcId : undefined;
  /** Whose mouth moves for this card's voice. */
  const voicedBy = ask ? askedBy : playerTurn ? undefined : node.speakerId;
  // A walk has no words, so there is nothing to voice.
  const voice = useLineVoice(voiceLibrary, audioSettings, node.interlude ? undefined : ask ? {
    key: lineKey,
    text: ask.text,
    languageCode: lineProps.languageCode,
    speakerId: askedBy,
    autoplay: true
  } : {
    key: lineKey,
    text: spoken,
    languageCode: lineLanguage,
    speakerId: playerTurn ? undefined : node.speakerId,
    autoplay: !playerTurn
  });
  const silent = voice.status === "off" || voice.status === "unavailable";
  // Sequences of prompts and lines, such as during pronunciation practice.
  const speaker = useSpeaker(voiceLibrary, audioSettings);

  // The learner sets the pace: pause holds the voice and the moving on; back replays the card before.
  const [paused, setPaused] = useState(false);
  const [arrival, setArrival] = useState<"back" | "forward" | undefined>(undefined);
  // Every card starts playing, whatever the one before was doing.
  useEffect(() => setPaused(false), [lineKey]);
  const autoAdvance = !SHOW_NEXT_BUTTON || Boolean(dialogue.autoAdvance);
  const willAdvance = autoAdvance && !node.response && !lineProps.thinking;
  const pausable = paused || willAdvance || voice.status === "loading" || voice.status === "playing" || speaker.speaking !== null;
  const pause = () => {
    setPaused(true);
    voice.pause();
    speaker.pause();
  };
  const resume = () => {
    setPaused(false);
    voice.resume();
    speaker.resume();
  };
  const back = () => {
    if (!onBack) return;
    speaker.stop();
    setArrival("back");
    onBack();
  };
  const forward = () => {
    if (!onForward) return;
    speaker.stop();
    setArrival("forward");
    onForward();
  };
  const input = (value: DialogueInput) => {
    setArrival(undefined);
    onInput(value);
  };
  // Asking to hear something is also asking to carry on.
  const lineVoice: LineVoice = { ...voice, play: (rate) => { setPaused(false); voice.play(rate); } };
  const speak = (items: SpokenItem[]) => {
    setPaused(false);
    return speaker.speak(items);
  };

  // A swipe in from the left edge of the screen goes back, as in iOS. Only the
  // edge listens, so tapping and dragging anywhere else is left to the scene.
  const [edgeDrag, setEdgeDrag] = useState<number | null>(null);
  const edge = useRef<{ x: number; y: number } | null>(null);
  const edgeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onBack) return;
    edge.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setEdgeDrag(0);
  };
  const edgeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (edge.current) setEdgeDrag(Math.max(0, event.clientX - edge.current.x));
  };
  const edgeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = edge.current;
    edge.current = null;
    setEdgeDrag(null);
    if (!start) return;
    const dx = event.clientX - start.x;
    if (dx > 70 && Math.abs(event.clientY - start.y) < dx) back();
  };
  const edgeCancel = () => {
    edge.current = null;
    setEdgeDrag(null);
  };

  const controls = (
    <>
      {/* Back and forward sit at the bottom, by the thumb, on the card's lower edge. */}
      <div className="card-nav" role="group" aria-label="Move through the conversation">
        <button className="card-nav-button" onClick={back} disabled={!onBack} aria-label="Back to the previous line">
          <img src={icons.back} alt="" />
        </button>
        {onForward && (
          <button className="card-nav-button" onClick={forward} aria-label="Forward to the next line you've seen">
            <img src={icons.back} className="mirrored" alt="" />
          </button>
        )}
      </div>
      <button
        className={`round-button card-pause${paused ? " paused" : ""}`}
        onClick={paused ? resume : pause}
        disabled={!pausable}
        aria-pressed={paused}
        aria-label={paused ? "Play" : "Pause"}
      >
        <img src={paused ? icons.play : icons.pause} alt="" />
      </button>
    </>
  );

  // The partner's mouth follows the voice, or a timed flap when there is no sound.
  const flap = useSpeakingPulse(lineKey, ask?.text ?? spoken, silent && Boolean(voicedBy) && !paused);
  const speaking = speaker.speaking ? speaker.speaking.mouthOpen : Boolean(voicedBy) && (silent ? flap : voice.mouthOpen);
  // During practice her gesture follows what she says. Elsewhere it is the line's own, and a
  // plain line alternates between two standing poses from card to card, so she never freezes.
  const [practiceLook, setPracticeLook] = useState<{ key: string; expression: CharacterExpression } | undefined>(undefined);
  const reportPracticeLook = useCallback((expression: CharacterExpression) => setPracticeLook({ key: lineKey, expression }), [lineKey]);
  const scripted = node.presentation?.expression ?? "neutral";
  // Whose close-up is shown: the line's focus, else whoever speaks it, else the partner.
  const portraitOf = (id: string | undefined) => {
    const characterId = id ? speakers[id]?.characterId : undefined;
    return characterId && resolveConversationVisual({ character: characterId }) ? characterId : undefined;
  };
  const portraitCharacter = portraitOf(node.presentation?.focus)
    ?? (playerTurn ? undefined : portraitOf(node.speakerId))
    ?? portraitOf(session.npcId);
  const showsPartner = portraitCharacter !== undefined && portraitCharacter === partner?.characterId;
  const expression = node.response?.kind === "practice" && practiceLook?.key === lineKey
    ? practiceLook.expression
    : showsPartner && scripted === "neutral" && session.history.length % 2 === 1 ? "talking" : scripted;
  // The mouth moves only on the one who is speaking.
  const portraitSpeaks = speaker.speaking !== null || (!playerTurn && portraitCharacter === speakers[node.speakerId]?.characterId);
  const framing = node.presentation?.framing ?? "close";
  // On the street the shot the last walk ended on is held: Sophie keeps her place and
  // looks back to talk, and anyone else is there in the street with her.
  const street = dialogue.staging === "street" && !node.interlude
    ? streetCamera(dialogue, [...session.history.map((entry) => entry.nodeId), node.id])
    : undefined;
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
      {replaying && (
        <span className="replay-tag top" title="Answers here are practice and don't change your progress">Replay</span>
      )}
      {onBack && (
        <div
          className="edge-swipe"
          aria-hidden="true"
          onPointerDown={edgeDown}
          onPointerMove={edgeMove}
          onPointerUp={edgeUp}
          onPointerCancel={edgeCancel}
        />
      )}
      <div className="conversation-tools">
        {onOpenScenes && (
          <button onClick={onOpenScenes} aria-label="Scenes: play a part of the story again">
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
      {node.interlude && (
        <WalkInterlude
          key={lineKey}
          walk={node.interlude}
          paused={paused}
          onDone={() => input({ type: "CONTINUE", assistance: [], heard: false, textVisible: false })}
          controls={<div className="walk-controls">{controls}</div>}
        />
      )}
      {street && (
        <StreetStage
          scene={street.scene}
          zoom={street.zoom}
          pose={node.presentation?.street?.pose}
          people={streetPeople(dialogue, [...session.history.map((entry) => entry.nodeId), node.id])}
          speakingId={speaking ? (speaker.speaking ? speaker.speaking.item.speakerId : voicedBy) : undefined}
        />
      )}
      <div className="conversation-stage">
        {portraitCharacter && !node.interlude && !street && (
          <CharacterPortrait
            key={portraitCharacter}
            character={portraitCharacter}
            expression={expression}
            speaking={portraitSpeaks && speaking}
            framing={framing}
            moving={expression === "walk-away" || expression === "walk-side"}
          />
        )}
      </div>
      {!node.interlude && (
      <div
        className={`conversation-dock${edgeDrag !== null ? " dragging" : ""}`}
        style={edgeDrag ? { transform: `translateX(${Math.min(edgeDrag, 160) * 0.5}px)` } : undefined}
      >
        <DialogueLine
          key={`${node.id}:${failures}:${session.history.length}`}
          node={node}
          line={line}
          speakerName={speakerName}
          partnerName={partner?.name}
          offerAnswers={suggestionsUnlocked(session, node.id)}
          retrying={failures > 0}
          voice={lineVoice}
          subtitles={audioSettings.subtitles}
          lastSaid={lastSaid}
          lineLanguage={lineLanguage}
          partnerId={session.npcId}
          askerName={askedBy ? speakers[askedBy]?.name ?? askedBy : undefined}
          interfaceLanguageCode={interfaceLanguageCode}
          speaking={speaker.speaking}
          speak={speak}
          autoAdvance={autoAdvance}
          paused={paused}
          controls={controls}
          arrival={arrival}
          onExpression={reportPracticeLook}
          onInput={input}
          {...lineProps}
        />
      </div>
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
