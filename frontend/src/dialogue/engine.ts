import { conditionHolds } from "../core/conditions";
import type { GameSave, Quest } from "../core/models";
import { applyGameEvent, type GameEvent } from "../core/quests";
import { assessUtterance } from "../learning/assessment";
import type { AssistanceKind, ConversationIntent, LearningModality, PronunciationDiagnostics, VocabularyItem } from "../learning/models";
import { helpUsed, recordLearningEvidence } from "../learning/progress";
import { adaptSupport } from "../learning/support";
import { vocabularyInText, vocabularySpans, type TextSpan } from "../learning/vocabulary";
import { recordLineEncounter } from "./evidence";
import { JUDGEMENT_CONFIDENCE_NEEDED, type UtteranceJudgement } from "./judgement";
import { PLAYER_SPEAKER_ID, type Dialogue, type DialogueNode } from "./models";
import { applyDialogueResponse } from "./responses";
import { buildSlotValues, resolveDialogueLine, resolveTemplate, type ResolvedLine, type SlotDefinition, type SlotValues } from "./template";

/** Misses on one question before the fitting answers are offered outright. */
export const ATTEMPTS_BEFORE_SUGGESTIONS = 2;

/** How one of the player's own answers went, for showing back to them. */
export interface SaidResult {
  mode: SayMode;
  communicated: boolean;
  /** Which try this was at the question. */
  attempt: number;
  /** A translation, hint, replay or model answer was used. */
  helped: boolean;
  /** The stretches of the answer that were credited as vocabulary the player used. */
  usedWords: TextSpan[];
  /** How a spoken answer was pronounced, when it was scored. */
  pronunciation?: PronunciationDiagnostics;
}

export interface HistoryLine {
  nodeId: string;
  speakerId: string;
  text: string;
  translation?: string;
  /** For something the player said: another way to say it, offered afterwards. */
  rewording?: string;
  /** Present on the player's own spoken, typed or picked answers. */
  said?: SaidResult;
}

/** A conversation in progress. Plain data, so it can be stored, tested and replayed. */
export interface DialogueSession {
  dialogueId: string;
  npcId?: string;
  nodeId: string;
  status: "active" | "completed";
  /** Question to come back to after the other speaker's repair line. */
  returnNodeId?: string;
  failedAttempts: Record<string, number>;
  /**
   * Words for one line that replace its scripted text, used when the other speaker
   * reacts to what the player actually said. The node, and so everything the line
   * does, stays the scripted one.
   */
  lineOverride?: { nodeId: string; text: string; translation?: string };
  /** Lines already passed, oldest first, for the player to look back at. */
  history: HistoryLine[];
}

export type SayMode = "speech" | "typed" | "selected";

export type DialogueInput = (
  | { type: "CONTINUE" }
  | { type: "ANSWER"; value: string }
  | {
      type: "SAY";
      text: string;
      mode: SayMode;
      /** A second opinion on `text`. Advice only: the engine checks it against the line. */
      judgement?: UtteranceJudgement;
      /** How it was pronounced, for spoken answers that were scored. Kept, never judged. */
      pronunciation?: PronunciationDiagnostics;
    }
  | { type: "ACT"; optionId: string }
  | { type: "PRACTICED" }
) & {
  assistance: AssistanceKind[];
  /** The line's audio was actually listened to. */
  heard?: boolean;
  /** The line's written text was on screen. Defaults to true. */
  textVisible?: boolean;
};

export interface DialogueContext {
  quests: Quest[];
  intents: Record<string, ConversationIntent>;
  slots: Record<string, SlotDefinition>;
  vocabulary: VocabularyItem[];
  /** ISO timestamp for the evidence written by this step. */
  now: string;
}

export interface DialogueStep {
  session: DialogueSession;
  save: GameSave;
  /** `ignored`: the input did not fit the current line. `repair`: the meaning did not come across. */
  result: "advanced" | "completed" | "repair" | "ignored";
}

const MODALITY: Record<SayMode, LearningModality> = { speech: "speaking", typed: "writing", selected: "reading" };

export function startDialogue(dialogue: Dialogue, npcId?: string): DialogueSession {
  return { dialogueId: dialogue.id, npcId, nodeId: dialogue.startNodeId, status: "active", failedAttempts: {}, history: [] };
}

/** True once the player has missed often enough that the fitting answers should simply be offered. */
export function suggestionsUnlocked(session: DialogueSession, nodeId: string): boolean {
  return (session.failedAttempts[nodeId] ?? 0) >= ATTEMPTS_BEFORE_SUGGESTIONS;
}

/** The words of the session's current line: the scripted text, or the reaction standing in for it. */
export function sessionLine(session: DialogueSession, node: DialogueNode, values: SlotValues): ResolvedLine {
  const override = session.lineOverride;
  if (override?.nodeId !== node.id) return resolveDialogueLine(node, values);
  return {
    target: { text: override.text, spans: [] },
    translation: override.translation === undefined ? undefined : { text: override.translation, spans: [] }
  };
}

function nextNodeId(node: DialogueNode, save: GameSave, quests: Quest[], override?: string): string | undefined {
  if (override) return override;
  const branch = node.branches?.find((item) => item.when.every((condition) => conditionHolds(condition, save, quests)));
  return branch?.nextNodeId ?? node.nextNodeId;
}

function applyEffects(save: GameSave, dialogue: Dialogue, node: DialogueNode, raised: GameEvent[]): GameSave {
  const key = `${dialogue.id}.${node.id}`;
  if (!node.effects?.length || save.appliedEffects.includes(key)) return save;
  let next: GameSave = { ...save, appliedEffects: [...save.appliedEffects, key] };
  for (const effect of node.effects) {
    const quantity = effect.quantity ?? 1;
    next = { ...next, inventory: { ...next.inventory, [effect.itemId]: (next.inventory[effect.itemId] ?? 0) + quantity } };
    raised.push({ type: "ITEM_ACQUIRED", itemId: effect.itemId });
  }
  return next;
}

/**
 * Advance a conversation by one player input. Pure: everything a line causes
 * (evidence, profile answers, effects, quest events) is returned in the new save,
 * and nothing here knows about React or Phaser.
 */
export function stepDialogue(
  session: DialogueSession,
  dialogue: Dialogue,
  input: DialogueInput,
  save: GameSave,
  context: DialogueContext
): DialogueStep {
  const node = dialogue.nodes[session.nodeId];
  if (session.status !== "active" || !node) return { session, save, result: "ignored" };

  const response = node.response;
  const line = sessionLine(session, node, buildSlotValues(context.slots, save.player.profile));
  const events: GameEvent[] = [];
  const failures = session.failedAttempts[node.id] ?? 0;
  const lineVocabulary = vocabularyInText(line.target.text, context.vocabulary);
  // Understanding a line counts as listening only when it was heard without its text.
  const heard = input.heard ?? false;
  const textVisible = input.textVisible ?? true;
  const lineModality: LearningModality = heard && !textVisible ? "listening" : "reading";
  /** A line both read and heard is reading evidence plus listening exposure, kept apart. */
  const alsoHeard = (state: GameSave) => (
    heard && textVisible ? recordLineEncounter(state, node, lineVocabulary, "listening", input.assistance, context.now) : state
  );
  let next = save;
  let said: string | undefined;
  let saidResult: SaidResult | undefined;
  let rewording: string | undefined;
  let nextOverride: string | undefined;

  const miss = (repairNodeId: string | undefined, evidence: GameSave, reply?: UtteranceJudgement["reply"]): DialogueStep => {
    const repair = repairNodeId && dialogue.nodes[repairNodeId] ? repairNodeId : undefined;
    return {
      save: evidence,
      result: "repair",
      session: {
        ...session,
        failedAttempts: { ...session.failedAttempts, [node.id]: failures + 1 },
        history: said === undefined ? session.history : [...session.history, { nodeId: node.id, speakerId: PLAYER_SPEAKER_ID, text: said, said: saidResult }],
        // The repair line is spoken, then the conversation returns to this question.
        ...(repair ? { nodeId: repair, returnNodeId: node.id } : {}),
        // The other speaker may react to what was actually said, in place of the scripted repair words.
        lineOverride: repair && reply ? { nodeId: repair, ...reply } : undefined
      }
    };
  };

  if (!response || response.kind === "continue") {
    if (input.type !== "CONTINUE") return { session, save, result: "ignored" };
    // A line in the learner's own language teaches nothing about the target language.
    if (node.language !== "interface") {
      next = alsoHeard(recordLineEncounter(next, node, lineVocabulary, lineModality, input.assistance, context.now));
    }
  } else if (response.kind === "practice") {
    // Practice is finished whenever the player moves on; how it went never gates progress.
    if (input.type !== "PRACTICED") return { session, save, result: "ignored" };
  } else if (response.kind === "text" || response.kind === "choice") {
    if (input.type !== "ANSWER") return { session, save, result: "ignored" };
    const answered = applyDialogueResponse(next, response, input.value);
    if (answered === next) return { session, save, result: "ignored" };
    next = node.language === "interface"
      ? answered
      : alsoHeard(recordLineEncounter(answered, node, lineVocabulary, lineModality, input.assistance, context.now));
    if (response.kind === "choice") nextOverride = response.options.find((option) => option.value === input.value)?.nextNodeId;
  } else if (response.kind === "say") {
    const intent = context.intents[response.intentId];
    if (input.type !== "SAY" || !intent || !input.text.trim()) return { session, save, result: "ignored" };
    said = input.text.trim();
    const rules = assessUtterance(said, intent);
    // The rules are certain when they match. When they do not, a second opinion may
    // still find the meaning, but only for this line's intent and only if it is sure.
    const judged = input.judgement;
    const secondOpinion = !rules.communicated && judged?.intentId === intent.id && judged.confidence >= JUDGEMENT_CONFIDENCE_NEEDED;
    const assessment = secondOpinion ? { communicated: true, confidence: judged.confidence } : rules;
    if (secondOpinion) rewording = judged.rewording;
    const assistance = input.mode === "typed" ? [...input.assistance, "typed-fallback" as const] : input.assistance;
    // Credit only the words the learner actually used, and only when the meaning came across.
    const used = assessment.communicated ? vocabularyInText(said, context.vocabulary) : [];
    const usedConcepts = context.vocabulary.filter((item) => used.includes(item.id)).flatMap((item) => item.conceptIds);
    const evidence = recordLearningEvidence(next, {
      // Saying "s'il vous plaît" while ordering is also evidence of asking politely.
      conceptIds: [...new Set([intent.conceptId, ...usedConcepts])],
      vocabularyIds: used,
      modality: MODALITY[input.mode],
      outcome: assessment.communicated ? "successful" : "unsuccessful",
      assistance,
      attempts: failures + 1,
      at: context.now,
      confidence: assessment.confidence,
      // Kept with the attempt, so what needs practice can be brought back later.
      ...(input.pronunciation ? { pronunciation: input.pronunciation } : {})
    });
    saidResult = {
      mode: input.mode,
      communicated: assessment.communicated,
      attempt: failures + 1,
      helped: helpUsed(assistance).length > 0,
      usedWords: vocabularySpans(said, context.vocabulary, used),
      ...(input.pronunciation ? { pronunciation: input.pronunciation } : {})
    };
    if (!assessment.communicated) return miss(response.repairNodeId, evidence, judged?.intentId === null ? judged.reply : undefined);
    next = adaptSupport(evidence);
    events.push({ type: "INTENT_COMMUNICATED", intentId: intent.id });
  } else {
    const option = input.type === "ACT" ? response.options.find((item) => item.id === input.optionId) : undefined;
    if (!option) return { session, save, result: "ignored" };
    const evidence = recordLearningEvidence(next, {
      // Acting on a line shows the line was understood, with everything it carries.
      conceptIds: option.correct ? [...new Set([response.conceptId, ...node.conceptIds])] : [response.conceptId],
      vocabularyIds: option.correct ? lineVocabulary : [],
      modality: lineModality,
      outcome: option.correct ? "successful" : "unsuccessful",
      assistance: input.assistance,
      attempts: failures + 1,
      at: context.now
    });
    if (!option.correct) return miss(response.repairNodeId, evidence);
    next = alsoHeard(adaptSupport(evidence));
    events.push({ type: "CONCEPT_DEMONSTRATED", conceptId: response.conceptId });
  }

  next = applyEffects(next, dialogue, node, events);
  next = applyGameEvent(next, context.quests, { type: "DIALOGUE_LINE_COMPLETED", dialogueId: dialogue.id, nodeId: node.id, npcId: session.npcId });
  for (const event of events) next = applyGameEvent(next, context.quests, event);

  const history: HistoryLine[] = [
    ...session.history,
    node.speakerId === PLAYER_SPEAKER_ID
      ? { nodeId: node.id, speakerId: PLAYER_SPEAKER_ID, text: said ?? line.target.text, ...(rewording ? { rewording } : {}), ...(saidResult ? { said: saidResult } : {}) }
      : { nodeId: node.id, speakerId: node.speakerId, text: line.target.text, translation: line.translation?.text }
  ];

  // A repair line with nowhere of its own to go hands back to the question it interrupted.
  const target = nextNodeId(node, next, context.quests, nextOverride) ?? session.returnNodeId;
  if (target && dialogue.nodes[target]) {
    return {
      save: next,
      result: "advanced",
      session: { ...session, nodeId: target, returnNodeId: target === session.returnNodeId ? undefined : session.returnNodeId, lineOverride: undefined, history }
    };
  }

  next = applyGameEvent(next, context.quests, { type: "DIALOGUE_COMPLETED", dialogueId: dialogue.id, npcId: session.npcId });
  return { save: next, result: "completed", session: { ...session, status: "completed", returnNodeId: undefined, lineOverride: undefined, history } };
}

/** The player's possible lines for a `say` response, with slots filled, marked by whether they fit. */
export function resolveSayOptions(node: DialogueNode, save: GameSave, context: Pick<DialogueContext, "intents" | "slots">) {
  const response = node.response;
  if (response?.kind !== "say") return [];
  const intent = context.intents[response.intentId];
  const values = buildSlotValues(context.slots, save.player.profile);
  const target = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.target]));
  const translation = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.translation]));
  return (response.options ?? []).map((option) => {
    const text = resolveTemplate(option.text, target).text;
    return {
      id: option.id,
      text,
      translation: option.translation === undefined ? undefined : resolveTemplate(option.translation, translation).text,
      fits: intent ? assessUtterance(text, intent).communicated : false
    };
  });
}
