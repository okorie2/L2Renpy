import { StoryWorldViewport, useStoryWorld } from "../world3d/StoryWorld";
import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation, type ConversationSpeaker } from "./components/Conversation";
import { SceneMenu } from "./components/SceneMenu";
import type { StoryPart } from "../content/story";
import { OpeningScene, type OpeningArt, type OpeningStage, type SceneLayer } from "./components/OpeningScene";
import { sceneAt } from "../content/scenes";
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
import { chapterOneItems, chapterOneLocations, chapterOneMessages, chapterOneNpcs, chapterOneQuests, chapterOneSceneSpeakers, createStartingPlayer } from "../content/chapter1";
import { mapPlaces, metCharacters } from "../phone/directory";
import { deliverMessages, markThreadRead, saveThreadSession, unreadThreadIds } from "../phone/messages";
import { resolveSayOptions, startDialogue, stepDialogue, type DialogueInput, type DialogueSession } from "../dialogue/engine";
import { afterLiveStep, afterReplayStep, canGoBack, canGoForward, currentCard, goBack, goForward, isReplaying, startTrail, type Trail } from "../dialogue/trail";
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
  [...chapterOneNpcs, ...chapterOneSceneSpeakers].map((npc) => [npc.id, { name: npc.name, characterId: npc.appearanceId }])
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
/**
 * The opening story, played in order with Sophie before the street opens up:
 * Scene 1 in the park (meeting her), then Scene 2 (the walk to the café).
 * The opening ends when the last one is complete.
 */
const OPENING = { npcId: "sophie", dialogueIds: ["meetSophie", "walkToCafe"] };
const OPENING_LAST = OPENING.dialogueIds[OPENING.dialogueIds.length - 1];
/** Where the walk to the café leaves the player: at the café door. */
const OPENING_ARRIVAL = { locationId: "neighborhood", spawnId: "outsideCafe" };
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
  const story3d = useStoryWorld();
  const [nearNpcIds, setNearNpcIds] = useState<Set<string>>(() => new Set());
  const [nearPortalIds, setNearPortalIds] = useState<Set<string>>(() => new Set());
  const [moving, setMoving] = useState(false);
  // Every card reached in the conversation, and which one is on screen.
  const [trail, setTrail] = useState<Trail | null>(null);
  const conversation = trail ? currentCard(trail) : null;
  /** Start or end a conversation; a new one has nothing behind it. */
  const setConversation = (session: DialogueSession | null) => setTrail(session ? startTrail(session) : null);
  // True while a second opinion on the learner's answer is on its way.
  const [thinking, setThinking] = useState(false);
  const judgedTurn = useRef(0);
  // The scene menu, and a finished part being played again (it ends where it ends, without running on).
  const [scenesOpen, setScenesOpen] = useState(false);
  const [replay, setReplay] = useState<{ dialogueId: string } | null>(null);
  const [run, setRun] = useState(0);
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
    initialSave.completedDialogueIds.includes(OPENING_LAST) ? "done"
      // Met Sophie already: pick the story up where it was left, in the park.
      : initialSave.completedDialogueIds.includes(OPENING.dialogueIds[0]) ? "talking"
      : "title"
  ));
  const openingFinished = save.completedDialogueIds.includes(OPENING_LAST);
  useEffect(() => {
    if (!openingFinished || opening === "done" || opening === "leaving") return;
    setOpening("leaving");
    const timer = window.setTimeout(() => setOpening("done"), OPENING_FADE_MS);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingFinished]);
  // Bumped when the story puts the player somewhere new, so the world is rebuilt there.
  const [worldEpoch, setWorldEpoch] = useState(0);

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
  }), [location, worldEpoch]);

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
  // It resumes at the first part of the opening story not yet finished.
  const nextOpeningDialogue = () => {
    const id = OPENING.dialogueIds.find((item) => !save.completedDialogueIds.includes(item));
    return id ? activeLanguagePack.dialogues[id] : undefined;
  };
  const startOpeningConversation = () => {
    const dialogue = nextOpeningDialogue();
    if (!dialogue) return;
    unlockVoice();
    refreshSpeech();
    setConversation(startDialogue(dialogue, OPENING.npcId));
  };

  /**
   * Play a part of the story from its start. A finished part is a replay: it counts,
   * added to the record, and ends by going back to where the learner was. The part
   * they're on simply starts again and carries on into the next, as it always would.
   */
  const playPart = (part: StoryPart) => {
    const dialogue = part.dialogueId ? activeLanguagePack.dialogues[part.dialogueId] : undefined;
    if (!dialogue) return;
    judgedTurn.current++;
    setThinking(false);
    setScenesOpen(false);
    setPhone(null);
    unlockVoice();
    refreshSpeech();
    setReplay(save.completedDialogueIds.includes(dialogue.id) ? { dialogueId: dialogue.id } : null);
    // The story is told over the park and its streets, not the world.
    setOpening("talking");
    setRun((current) => current + 1);
    setConversation(startDialogue(dialogue, OPENING.npcId));
  };
  /** A replay is over: back to the world, or to the park if the story isn't finished yet. */
  const endReplay = () => {
    setReplay(null);
    if (!save.completedDialogueIds.includes(OPENING_LAST)) return;
    setOpening("leaving");
    window.setTimeout(() => setOpening("done"), OPENING_FADE_MS);
  };

  // The painted place behind the opening story's current line, once it leaves the park.
  const openingScene = useMemo<SceneLayer | undefined>(() => {
    if (!conversation || !dialogue || !OPENING.dialogueIds.includes(conversation.dialogueId)) return undefined;
    const scene = sceneAt(
      [...conversation.history.map((line) => line.nodeId), conversation.nodeId],
      (nodeId) => dialogue.nodes[nodeId]?.presentation?.scene
    );
    if (!scene || scene.id === "park") return undefined;
    return { ...scene, image: assetUrl(scene.image), standIn: assetUrl(scene.standIn) };
  }, [conversation, dialogue]);
  // The last place stays up while the opening fades into the street, so the park does not flash back.
  const lastOpeningScene = useRef<SceneLayer | undefined>(undefined);
  if (openingScene) lastOpeningScene.current = openingScene;
  const shownOpeningScene = openingScene ?? (opening === "leaving" ? lastOpeningScene.current : undefined);

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
    return judgement ? { ...stepDialogue(session, spoken, { ...input, judgement }, save, dialogueContext()), judgement } : step;
  };

  /**
   * Was a spoken answer understood? Asked before it is sent, so the card can stay
   * while Sophie reacts to it. The second opinion, if one was needed, travels with
   * the answer so it is not asked for twice.
   */
  const checkSaid = async (input: DialogueInput): Promise<{ understood: boolean; input: DialogueInput }> => {
    if (!conversation || !dialogue || input.type !== "SAY") return { understood: false, input };
    const turn = judgedTurn.current;
    const step = await stepWithSecondOpinion(conversation, dialogue, conversationNpc, input, location, () => setThinking(true));
    if (turn === judgedTurn.current) setThinking(false);
    const understood = step.result === "advanced" || step.result === "completed";
    return { understood, input: "judgement" in step && step.judgement ? { ...input, judgement: step.judgement } : input };
  };

  // Report the input; the dialogue engine decides what it means for the save and the conversation.
  const sendDialogueInput = async (input: DialogueInput) => {
    if (!trail || !conversation || !dialogue || thinking) return;
    const turn = ++judgedTurn.current;
    const step = await stepWithSecondOpinion(conversation, dialogue, conversationNpc, input, location, () => setThinking(true));
    // The learner left the conversation, or moved to another card, while waiting.
    if (turn !== judgedTurn.current) return;
    setThinking(false);
    // A replayed card is practice: it moves the replay along and records nothing.
    if (isReplaying(trail)) {
      setTrail(afterReplayStep(trail, step));
      return;
    }
    if (step.session.status !== "completed") {
      setSave(step.save);
      setTrail(afterLiveStep(trail, step));
      return;
    }
    // A replay ends with its own part; everything it showed is already in the save.
    if (replay && step.session.dialogueId === replay.dialogueId) {
      setSave(step.save);
      setTrail(null);
      endReplay();
      return;
    }
    // The opening story runs on from one scene into the next without a break.
    const storyIndex = OPENING.dialogueIds.indexOf(step.session.dialogueId);
    const following = storyIndex >= 0 ? activeLanguagePack.dialogues[OPENING.dialogueIds[storyIndex + 1]] : undefined;
    if (following) {
      setSave(step.save);
      setConversation(startDialogue(following, OPENING.npcId));
      return;
    }
    if (step.session.dialogueId === OPENING_LAST) {
      // Scene 2 ends at the café: the street opens with the player at its door.
      const street = chapterOneLocations.find((item) => item.id === OPENING_ARRIVAL.locationId);
      const door = street?.spawnPoints[OPENING_ARRIVAL.spawnId];
      setSave(street && door
        ? { ...step.save, player: { ...step.save.player, locationId: street.id, position: { ...door } } }
        : step.save);
      setWorldEpoch((current) => current + 1);
    } else {
      setSave(step.save);
    }
    setTrail(null);
  };
  /** Back to an earlier card, or forward again as far as the furthest reached. */
  const moveInConversation = (move: (current: Trail) => Trail) => {
    if (!trail) return;
    // Anything still being decided about the card being left no longer applies.
    judgedTurn.current++;
    setThinking(false);
    setTrail(move(trail));
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
    if (replay) endReplay();
  };

  return (
    <main className={`app${story3d.ready && story3d.shot ? " has-3d-story" : ""}${conversation ? " in-conversation" : ""}${opening !== "done" ? " in-opening" : ""}`}>
      <header className="hud">
        <button className="quest-summary" onClick={() => openPhone({ app: "quests" })} aria-label="Open quests">
          <span className="eyebrow">
            {guidance
              ? `QUEST ${String(questNumber).padStart(2, "0")} · ${guidance.quest.title.toUpperCase()}`
              : "CHAPTER 1"}
          </span>
          <strong>{guidance?.text ?? "All quests complete. Keep exploring!"}</strong>
        </button>

        <button className="phone-button scenes-button" onClick={() => setScenesOpen(true)} aria-label="Scenes: play a part of the story again">
          <span aria-hidden="true">≡</span>
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

      <GameView key={`${location.id}:${worldEpoch}`} world={world} />
      <StoryWorldViewport />

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
        talkLabel={save.completedDialogueIds.includes(OPENING.dialogueIds[0]) ? "Continue with Sophie" : "Talk to Sophie"}
        scene={shownOpeningScene}
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
          key={`${dialogue.id}:${run}`}
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
          checkSaid={checkSaid}
          onBack={trail && canGoBack(trail) ? () => moveInConversation(goBack) : undefined}
          onForward={trail && canGoForward(trail) ? () => moveInConversation(goForward) : undefined}
          replaying={Boolean(trail && isReplaying(trail))}
          onExit={leaveConversation}
          onOpenScenes={() => setScenesOpen(true)}
        />
      )}

      {scenesOpen && (
        <SceneMenu save={save} pack={activeLanguagePack} onReplay={playPart} onClose={() => setScenesOpen(false)} />
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
