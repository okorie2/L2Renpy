import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation, type ConversationSpeaker } from "./components/Conversation";
import { OpeningScene, type OpeningArt, type OpeningStage } from "./components/OpeningScene";
import { GameView } from "./components/GameView";
import { Phone, type PhoneRoute } from "./components/phone/Phone";
import type { ThreadEntry } from "./components/phone/MessagesApp";
import { assetUrl } from "./assets";
import { resolveConversationVisual, resolveWorldVisual } from "../characters/resolve";
import type { WorldPoseAsset, WorldVisual } from "../characters/types";
import { selectNpcDialogueId } from "../core/conditions";
import { createInitialSave, questGuidance, questLog } from "../core/quests";
import { travelThroughPortal, updatePlayerPosition } from "../core/world";
import type { WorldPosition } from "../core/models";
import { chapterOneItems, chapterOneLocations, chapterOneMessages, chapterOneNpcs, chapterOneQuests, createStartingPlayer } from "../content/chapter1";
import { mapPlaces, metCharacters } from "../phone/directory";
import { deliverMessages, markThreadRead, saveThreadSession, unreadThreadIds } from "../phone/messages";
import { resolveSayOptions, startDialogue, stepDialogue, type DialogueInput, type DialogueSession } from "../dialogue/engine";
import { PLAYER_SPEAKER_ID } from "../dialogue/models";
import { buildSlotValues } from "../dialogue/template";
import { buildTurnContext } from "../conversation/context";
import { createHttpTurnJudge } from "../conversation/httpJudge";
import { activeLanguagePack } from "../languages";
import { chapterOneConcepts } from "../learning/concepts";
import { summarizeLearning } from "../learning/summary";
import { createHttpSpeechToText, fetchSpeechCapabilities } from "../speech/httpStt";
import { createHttpTextToSpeech } from "../speech/httpTts";
import { createHttpPractice } from "../speech/httpPractice";
import { findRecording, RECORDED_LINES, withRecordings } from "../speech/recordings";
import { createVoicePack } from "../speech/voicePack";
import type { AudioClip, SpeechCapability } from "../speech/types";
import { canRecord } from "./recorder";
import { VoiceLibrary } from "../speech/voiceLibrary";
import { playText, releaseSpeech, unlockVoice, useAudioSettings } from "./voice";
import { useSavedGame, type SaveNotice } from "./savedGame";
import { createSaveStore } from "../save/store";
import { createBrowserStorage } from "../save/storage";
import type { GameSave, NPC } from "../core/models";
import type { Dialogue, DialogueNode } from "../dialogue/models";
import { gameEvents } from "../world/events";
import type { ConversationFocus, WorldSceneConfig } from "../world/MainScene";

const newGame = () => createInitialSave(createStartingPlayer(activeLanguagePack.code), chapterOneQuests);
// Progress lives on this device only. Sound settings are kept separately, per device.
const saveStore = createSaveStore(createBrowserStorage(), {
  quests: chapterOneQuests,
  locations: chapterOneLocations,
  startingPlayer: createStartingPlayer(activeLanguagePack.code),
  dialogues: activeLanguagePack.dialogues
});
// The street is the map; the other locations are the buildings on it.
const mapLocation = chapterOneLocations.find((item) => item.kind === "neighborhood") ?? chapterOneLocations[0];
const SAVE_NOTICES: Record<SaveNotice, string> = {
  unreadable: "Your saved game couldn't be read, so this is a new game. The old data is still on this device.",
  newer: "This saved game comes from a newer version. Update the game to continue it. Nothing you do now will be saved.",
  failed: "Your progress can't be saved on this device right now."
};
const npcSpeakers: Record<string, ConversationSpeaker> = Object.fromEntries(
  chapterOneNpcs.map((npc) => [npc.id, { name: npc.name, characterId: npc.appearanceId }])
);

// Catalog paths become URLs here, so the world layer never knows where assets live.
const characterVisuals: Record<string, WorldVisual> = {};
const withUrls = (pose: WorldPoseAsset): WorldPoseAsset => ({
  ...pose,
  frames: pose.frames.map(assetUrl),
  ...(pose.back ? { back: pose.back.map(assetUrl) } : {}),
  ...(pose.side ? { side: pose.side.map(assetUrl) } : {})
});
// The player is looked up like any other character, so art for them drops in the same way.
for (const appearanceId of ["player", ...chapterOneNpcs.map((npc) => npc.appearanceId)]) {
  const visual = resolveWorldVisual(appearanceId);
  if (!visual) continue;
  characterVisuals[appearanceId] = {
    ...visual,
    poses: { idle: withUrls(visual.poses.idle), walking: withUrls(visual.poses.walking), waving: withUrls(visual.poses.waving) }
  };
}

// Voiced lines come from the application backend, except the recordings shipped with
// the game (Sophie's welcome). Without a backend only those play.
const apiUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : undefined);
// Every line that is the same for everyone is shipped in the voice pack; the backend makes the rest.
const voicePack = createVoicePack(assetUrl);
const voiceLibrary = new VoiceLibrary(
  withRecordings(apiUrl ? createHttpTextToSpeech(apiUrl) : undefined, RECORDED_LINES, assetUrl, undefined, voicePack),
  {
    onEvict: releaseSpeech,
    isLocal: (request) => ((request.rate ?? "normal") === "normal" && findRecording(RECORDED_LINES, request) !== undefined) || voicePack.has(request)
  }
);
// Pronunciation practice: the backend compares the learner with the character's own voice.
const practiceClient = apiUrl ? createHttpPractice(apiUrl) : undefined;
/** The learner's own language, for lines such as Sophie's welcome. */
const INTERFACE_LANGUAGE = "en";
/** The first story beat: the dialogue whose completion ends the opening. */
const OPENING = { npcId: "sophie", dialogueId: "meetSophie" };
const OPENING_ART: OpeningArt = {
  backdrop: assetUrl("locations/park.webp"),
  idle: assetUrl("characters/sophie/opening/idle.webp"),
  waving: assetUrl("characters/sophie/opening/waving.webp"),
  // Two poses, one stride on each foot.
  walking: [2, 5].map((frame) => assetUrl(`characters/sophie/opening/walking-${frame}.webp`))
};
/** How long the park takes to fade into the street. */
const OPENING_FADE_MS = 700;

const speechToText = apiUrl ? createHttpSpeechToText(apiUrl) : undefined;
const transcribe = speechToText
  ? (clip: AudioClip, signal: AbortSignal) => speechToText.transcribe({ audio: clip, languageCode: activeLanguagePack.code, signal })
  : undefined;

// A second opinion on answers the game's own rules did not recognise. Optional, like the voices.
const turnJudge = apiUrl ? createHttpTurnJudge(apiUrl) : undefined;
const CHAPTER_LEVEL = "A1";

export default function App() {
  const saved = useSavedGame(saveStore, newGame);
  return (
    <Game
      key={saved.epoch}
      initialSave={saved.initialSave}
      onSaveChange={saved.persist}
      onStartOver={saved.startOver}
      saveNotice={saved.notice}
      onDismissSaveNotice={saved.dismissNotice}
    />
  );
}

type GameProps = {
  initialSave: GameSave;
  onSaveChange: (save: GameSave) => void;
  onStartOver: () => void;
  saveNotice: SaveNotice | null;
  onDismissSaveNotice: () => void;
};

function Game({ initialSave, onSaveChange, onStartOver, saveNotice, onDismissSaveNotice }: GameProps) {
  const [nearNpcIds, setNearNpcIds] = useState<Set<string>>(() => new Set());
  const [nearPortalIds, setNearPortalIds] = useState<Set<string>>(() => new Set());
  const [moving, setMoving] = useState(false);
  const [conversation, setConversation] = useState<DialogueSession | null>(null);
  // True while a second opinion on the learner's answer is on its way.
  const [thinking, setThinking] = useState(false);
  const judgedTurn = useRef(0);
  const [save, setSave] = useState(initialSave);
  useEffect(() => onSaveChange(save), [save, onSaveChange]);
  // The phone holds everything that is not the world: messages, map, quests, progress, settings.
  const [phone, setPhone] = useState<PhoneRoute | null>(null);
  const [thinkingThreadId, setThinkingThreadId] = useState<string | undefined>(undefined);
  const [messageNotice, setMessageNotice] = useState<string | null>(null);
  // Messages arrive from game state, whatever changed it.
  useEffect(() => {
    setSave((current) => deliverMessages(current, chapterOneMessages, activeLanguagePack.dialogues, chapterOneQuests, new Date().toISOString()));
  }, [save]);
  const [audioSettings, setAudioSettings] = useAudioSettings();
  // The microphone is offered only when the backend can hear and this device can record.
  const [recognitionReady, setRecognitionReady] = useState(false);
  const [pronunciationReady, setPronunciationReady] = useState(false);
  const refreshSpeech = () => {
    if (apiUrl && canRecord()) {
      void fetchSpeechCapabilities(apiUrl).then((capabilities) => {
        setRecognitionReady(capabilities.recognition);
        setPronunciationReady(capabilities.pronunciation);
      });
    }
  };
  useEffect(refreshSpeech, []);
  const speechCapability: SpeechCapability = recognitionReady ? { available: true } : { available: false, reason: "unavailable" };
  const [completedNotice, setCompletedNotice] = useState<string | null>(null);
  const location = chapterOneLocations.find((item) => item.id === save.player.locationId) ?? chapterOneLocations[0];
  // The opening, as in the Ren'Py prototype: the park, a first tap, Sophie walking up
  // and waving, then her welcome. It lasts until her introduction is complete.
  const [opening, setOpening] = useState<OpeningStage>(() => (
    initialSave.completedDialogueIds.includes(OPENING.dialogueId) ? "done" : "title"
  ));
  const metSophie = save.completedDialogueIds.includes(OPENING.dialogueId);
  useEffect(() => {
    if (!metSophie || opening === "done" || opening === "leaving") return;
    setOpening("leaving");
    const timer = window.setTimeout(() => setOpening("done"), OPENING_FADE_MS);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metSophie]);

  // The Phaser scene is created at entry and keeps its own transient animation state.
  const world = useMemo<WorldSceneConfig>(() => ({
    location,
    // Someone the player has already spoken to is simply there; they do not arrive again.
    npcs: chapterOneNpcs.map((npc) => (
      npc.entrance && npc.dialogues.some((rule) => save.completedDialogueIds.includes(rule.dialogueId))
        ? { ...npc, entrance: undefined }
        : npc
    )),
    player: save.player,
    placeLabels: activeLanguagePack.placeLabels,
    characterVisuals,
    backdropUrl: location.backdrop ? assetUrl(location.backdrop) : undefined,
    props: location.props?.map((prop) => ({ ...prop, image: assetUrl(prop.image) }))
  // A position report updates the save, but should not recreate Phaser every frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [location]);

  useEffect(() => {
    const onNpcProximity = (id: string, near: boolean) => setNearNpcIds((current) => {
      const next = new Set(current);
      if (near) next.add(id); else next.delete(id);
      return next;
    });
    const onPortalProximity = (id: string, near: boolean) => setNearPortalIds((current) => {
      const next = new Set(current);
      if (near) next.add(id); else next.delete(id);
      return next;
    });
    const onPosition = (locationId: string, position: WorldPosition) => setSave((current) => {
      if (current.player.locationId !== locationId) return current;
      return updatePlayerPosition(current, position);
    });
    gameEvents.on("npc-proximity", onNpcProximity);
    gameEvents.on("portal-proximity", onPortalProximity);
    gameEvents.on("movement-state", setMoving);
    gameEvents.on("player-position", onPosition);
    return () => {
      gameEvents.off("npc-proximity", onNpcProximity);
      gameEvents.off("portal-proximity", onPortalProximity);
      gameEvents.off("movement-state", setMoving);
      gameEvents.off("player-position", onPosition);
    };
  }, []);

  const conversationNpcId = conversation?.npcId;
  const conversationNpc = useMemo(() => chapterOneNpcs.find((npc) => npc.id === conversationNpcId), [conversationNpcId]);
  const dialogue = conversation ? activeLanguagePack.dialogues[conversation.dialogueId] : undefined;

  useEffect(() => {
    gameEvents.emit("movement-lock", conversationNpc !== undefined || phone !== null || opening !== "done");
  }, [conversationNpc, phone, opening]);

  useEffect(() => {
    const focus: ConversationFocus | null = conversationNpc
      ? {
          npcId: conversationNpc.id,
          hideNpc: resolveConversationVisual({ character: conversationNpc.appearanceId }) !== undefined
        }
      : null;
    gameEvents.emit("conversation-focus", focus);
  }, [conversationNpc]);

  const slotValues = useMemo(
    () => buildSlotValues(activeLanguagePack.slots, save.player.profile),
    [save.player.profile]
  );

  const speakers = useMemo<Record<string, ConversationSpeaker>>(
    () => ({ ...npcSpeakers, [PLAYER_SPEAKER_ID]: { name: save.player.profile.displayName ?? "You" } }),
    [save.player.profile.displayName]
  );

  // Quest completion is announced from state, never decided here.
  const completedQuestIds = chapterOneQuests
    .filter((quest) => save.questProgress[quest.id]?.status === "completed")
    .map((quest) => quest.id);
  const announcedCount = useRef(completedQuestIds.length);
  useEffect(() => {
    if (completedQuestIds.length <= announcedCount.current) return;
    const latest = chapterOneQuests.find((quest) => quest.id === completedQuestIds.at(-1));
    announcedCount.current = completedQuestIds.length;
    if (!latest) return;
    setCompletedNotice(latest.title);
    const timer = window.setTimeout(() => setCompletedNotice(null), 3200);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedQuestIds.length]);

  const beginOpening = () => {
    // This tap is what lets the game play Sophie's voice.
    unlockVoice();
    refreshSpeech();
    setOpening("walking");
  };
  const welcome = () => {
    setOpening("talking");
    startOpeningConversation();
  };
  // The welcome happens in the park, whichever street the save says the player is on.
  const startOpeningConversation = () => {
    const dialogue = activeLanguagePack.dialogues[OPENING.dialogueId];
    if (!dialogue) return;
    unlockVoice();
    refreshSpeech();
    setConversation(startDialogue(dialogue, OPENING.npcId));
  };

  const learning = useMemo(() => summarizeLearning(save, chapterOneConcepts, activeLanguagePack.vocabulary), [save]);
  const nearbyNpc = chapterOneNpcs.find((npc) => npc.locationId === location.id && nearNpcIds.has(npc.id));
  const nearbyPortal = location.portals.find((portal) => nearPortalIds.has(portal.id));
  const guidance = questGuidance(save, chapterOneQuests);
  const questNumber = guidance ? chapterOneQuests.indexOf(guidance.quest) + 1 : chapterOneQuests.length;

  // A new message is announced once, when it arrives.
  const unreadIds = unreadThreadIds(save);
  const announcedUnread = useRef(unreadIds.length);
  useEffect(() => {
    const newest = unreadIds.at(-1);
    if (unreadIds.length > announcedUnread.current && newest) setMessageNotice(newest);
    announcedUnread.current = unreadIds.length;
    if (!unreadIds.length) setMessageNotice(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.length]);

  const threads: ThreadEntry[] = Object.entries(save.messages).flatMap(([id, state]) => {
    const contact = chapterOneNpcs.find((npc) => npc.id === state.session.npcId);
    const threadDialogue = activeLanguagePack.dialogues[state.session.dialogueId];
    return contact && threadDialogue ? [{ id, contact, dialogue: threadDialogue, state }] : [];
  });
  const noticeThread = threads.find((entry) => entry.id === messageNotice);
  const openPhone = (route: PhoneRoute) => {
    // Opened by a tap, which is what lets the phone play voices afterwards.
    unlockVoice();
    gameEvents.emit("cancel-movement");
    setPhone(route);
  };

  const startConversation = (npcId: string) => {
    const npc = chapterOneNpcs.find((item) => item.id === npcId);
    const dialogueId = npc && selectNpcDialogueId(npc, save, chapterOneQuests);
    const next = dialogueId ? activeLanguagePack.dialogues[dialogueId] : undefined;
    if (!npc || !next) return;
    // This runs inside the tap, which is what lets the browser play voices afterwards.
    unlockVoice();
    refreshSpeech();
    setConversation(startDialogue(next, npc.id));
  };

  // Report the input; the dialogue engine decides what it means for the save and the conversation.
  const dialogueContext = () => ({
    quests: chapterOneQuests,
    intents: activeLanguagePack.intents,
    slots: activeLanguagePack.slots,
    vocabulary: activeLanguagePack.vocabulary,
    now: new Date().toISOString()
  });
  /**
   * One step of any dialogue, face to face or by message. When the rules do not
   * recognise a free answer, a second opinion is asked for and the engine decides
   * again with it; without one, the first decision stands.
   */
  const stepWithSecondOpinion = async (
    session: DialogueSession, spoken: Dialogue, npc: NPC | undefined, input: DialogueInput, place: typeof location | undefined, onWaiting: () => void
  ) => {
    const step = stepDialogue(session, spoken, input, save, dialogueContext());
    const response = spoken.nodes[session.nodeId]?.response;
    const intent = response?.kind === "say" ? activeLanguagePack.intents[response.intentId] : undefined;
    if (!turnJudge || !npc || !intent || step.result !== "repair" || input.type !== "SAY" || input.mode === "selected") return step;
    onWaiting();
    const judgement = await turnJudge.judge(buildTurnContext({
      languageCode: activeLanguagePack.code,
      level: CHAPTER_LEVEL,
      npc,
      location: place,
      quests: chapterOneQuests,
      save,
      session,
      intent,
      vocabulary: activeLanguagePack.vocabulary,
      utterance: input.text
    }));
    return judgement ? stepDialogue(session, spoken, { ...input, judgement }, save, dialogueContext()) : step;
  };

  // Report the input; the dialogue engine decides what it means for the save and the conversation.
  const sendDialogueInput = async (input: DialogueInput) => {
    if (!conversation || !dialogue || thinking) return;
    const turn = ++judgedTurn.current;
    const step = await stepWithSecondOpinion(conversation, dialogue, conversationNpc, input, location, () => setThinking(true));
    // The learner left the conversation while waiting.
    if (turn !== judgedTurn.current) return;
    setThinking(false);
    setSave(step.save);
    setConversation(step.session.status === "completed" ? null : step.session);
  };

  // The same engine drives a message thread; its session is kept in the save.
  const sendThreadInput = async (threadId: string, input: DialogueInput) => {
    const entry = threads.find((item) => item.id === threadId);
    if (!entry || thinkingThreadId) return;
    const step = await stepWithSecondOpinion(entry.state.session, entry.dialogue, entry.contact, input, undefined, () => setThinkingThreadId(threadId));
    setThinkingThreadId(undefined);
    setSave(saveThreadSession(step.save, threadId, step.session));
  };
  const leaveConversation = () => {
    judgedTurn.current++;
    setThinking(false);
    setConversation(null);
  };

  return (
    <main className={`app${conversation ? " in-conversation" : ""}${opening !== "done" ? " in-opening" : ""}`}>
      <header className="hud">
        <button className="quest-summary" onClick={() => openPhone({ app: "quests" })} aria-label="Open quests">
          <span className="eyebrow">
            {guidance
              ? `QUEST ${String(questNumber).padStart(2, "0")} · ${guidance.quest.title.toUpperCase()}`
              : "CHAPTER 1"}
          </span>
          <strong>{guidance?.text ?? "All quests complete. Keep exploring!"}</strong>
        </button>

        <button
          className="phone-button"
          onClick={() => openPhone({})}
          aria-label={unreadIds.length ? `Open your phone, ${unreadIds.length} new message${unreadIds.length > 1 ? "s" : ""}` : "Open your phone"}
        >
          <span aria-hidden="true">📱</span>
          {unreadIds.length > 0 && <span className="badge" aria-hidden="true">{unreadIds.length}</span>}
        </button>
      </header>

      <GameView key={location.id} world={world} />

      {opening === "done" && (
        <div className="hint">
          {location.kind === "apartment" ? "Tap the floor to walk. Find the door to go outside." : "Tap to walk. Approach people and doors."}
        </div>
      )}

      <OpeningScene
        stage={opening}
        art={OPENING_ART}
        onStart={beginOpening}
        onArrived={welcome}
        onTalk={conversation ? undefined : startOpeningConversation}
        title={{ eyebrow: "CHAPTER 1", heading: "Bienvenue", headingLang: activeLanguagePack.code, text: "A sunny morning in the park. Someone is coming to say hello." }}
      />

      {!conversation && !phone && opening === "done" && (
        <div className="interaction-actions">
          {moving && <button className="stop-move" onClick={() => gameEvents.emit("cancel-movement")}>Stop walking</button>}
          {nearbyNpc && (
            <button
              className="interact"
              onClick={() => startConversation(nearbyNpc.id)}
            >
              💬 {activeLanguagePack.ui.interact} {nearbyNpc.name}
            </button>
          )}
          {nearbyPortal && (
            <button className="interact" onClick={() => setSave((current) => travelThroughPortal(current, chapterOneLocations, nearbyPortal.id, chapterOneQuests))}>
              ↗ {nearbyPortal.label}
            </button>
          )}
        </div>
      )}

      {dialogue && conversation && (
        <Conversation
          key={dialogue.id}
          dialogue={dialogue}
          session={conversation}
          languageCode={activeLanguagePack.code}
          interfaceLanguageCode={INTERFACE_LANGUAGE}
          practice={practiceClient}
          practiceAvailable={pronunciationReady && canRecord()}
          speakers={speakers}
          slotValues={slotValues}
          profile={save.player.profile}
          supportLevel={save.learningSupport.level}
          speech={speechCapability}
          transcribe={transcribe}
          voiceLibrary={voiceLibrary}
          audioSettings={audioSettings}
          onAudioSettingsChange={setAudioSettings}
          sayChoices={resolveSayOptions(dialogue.nodes[conversation.nodeId], save, activeLanguagePack)}
          thinking={thinking}
          onInput={(input) => void sendDialogueInput(input)}
          onExit={leaveConversation}
        />
      )}

      {saveNotice && !conversation && (
        <div className="save-notice" role="status">
          <p>{SAVE_NOTICES[saveNotice]}</p>
          <button onClick={onDismissSaveNotice}>OK</button>
        </div>
      )}

      {completedNotice && !conversation && (
        <div className="quest-toast" role="status">
          <span className="eyebrow">QUEST COMPLETE</span>
          <strong lang="fr">{completedNotice}</strong>
        </div>
      )}

      {noticeThread && !conversation && !phone && (
        <button className="quest-toast message-toast" onClick={() => openPhone({ app: "messages", threadId: noticeThread.id })}>
          <span className="eyebrow">NEW MESSAGE</span>
          <strong>{noticeThread.contact.name}</strong>
        </button>
      )}

      {phone && !conversation && (
        <Phone
          route={phone}
          onClose={() => setPhone(null)}
          languageCode={activeLanguagePack.code}
          languageName={activeLanguagePack.name}
          level={CHAPTER_LEVEL}
          xp={save.player.xp}
          playerName={save.player.profile.displayName ?? "toi"}
          guidance={guidance?.text}
          threads={threads}
          thinkingThreadId={thinkingThreadId}
          slotValues={slotValues}
          supportLevel={save.learningSupport.level}
          sayChoices={(node: DialogueNode) => resolveSayOptions(node, save, activeLanguagePack)}
          onThreadInput={(threadId, input) => void sendThreadInput(threadId, input)}
          onThreadRead={(threadId) => setSave((current) => markThreadRead(current, threadId))}
          places={mapPlaces(save, chapterOneLocations, chapterOneNpcs, chapterOneQuests)}
          mapLocation={mapLocation}
          placeLabels={activeLanguagePack.placeLabels}
          playerPosition={save.player.position}
          contacts={metCharacters(save, chapterOneNpcs)}
          questEntries={questLog(save, chapterOneQuests)}
          items={chapterOneItems}
          summary={learning}
          expressions={learning.concepts
            .filter((entry) => entry.standing !== "not-met")
            .map((entry) => ({ concept: entry.concept, examples: activeLanguagePack.conceptExpressions[entry.concept.id] ?? [] }))
            .filter((entry) => entry.examples.length > 0)}
          audioSettings={audioSettings}
          voicesAvailable={Boolean(apiUrl) && voiceLibrary.available}
          onAudioSettingsChange={setAudioSettings}
          onHear={apiUrl ? (text, speakerId) => playText(voiceLibrary, audioSettings, { text, languageCode: activeLanguagePack.code, speakerId }) : undefined}
          onStartOver={onStartOver}
        />
      )}
    </main>
  );
}
