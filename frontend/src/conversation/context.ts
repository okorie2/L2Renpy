import type { GameSave, Location, NPC, Quest } from "../core/models";
import { questGuidance } from "../core/quests";
import type { DialogueSession } from "../dialogue/engine";
import { PLAYER_SPEAKER_ID } from "../dialogue/models";
import type { ConversationIntent, VocabularyItem } from "../learning/models";

const RECENT_LINES = 6;
const KNOWN_WORDS = 40;
const EXAMPLES = 4;

/**
 * The scene, as much of it as a second opinion needs: who is speaking, where,
 * what the learner is trying to do, what was just said, and what this line
 * expects. It names no reward and carries no game state that could be changed,
 * and the learner's name is not included.
 */
export interface TurnContext {
  languageCode: string;
  level: string;
  npc: { name: string; role?: string; register?: "informal" | "formal" };
  place?: string;
  goal?: string;
  recentLines: Array<{ speaker: "npc" | "learner"; text: string }>;
  intents: Array<{ id: string; description: string; examples: string[] }>;
  knownVocabulary: string[];
  utterance: string;
  attempt: number;
}

export function buildTurnContext(input: {
  languageCode: string;
  level: string;
  npc: NPC;
  location?: Location;
  quests: Quest[];
  save: GameSave;
  session: DialogueSession;
  intent: ConversationIntent;
  vocabulary: VocabularyItem[];
  utterance: string;
}): TurnContext {
  const { npc, save, session, intent } = input;
  const goal = questGuidance(save, input.quests)?.text;
  return {
    languageCode: input.languageCode,
    level: input.level,
    npc: { name: npc.name, ...npc.persona },
    ...(input.location ? { place: input.location.name } : {}),
    ...(goal ? { goal } : {}),
    recentLines: session.history.slice(-RECENT_LINES).map((line) => ({
      speaker: line.speakerId === PLAYER_SPEAKER_ID ? "learner" as const : "npc" as const,
      text: line.text
    })),
    intents: [{
      id: intent.id,
      description: intent.meaning ?? intent.prompt,
      examples: (intent.acceptedExpressions ?? []).slice(0, EXAMPLES)
    }],
    // Words the learner has already met, so a reply can stay within them.
    knownVocabulary: input.vocabulary.filter((item) => save.vocabularyMastery[item.id]).map((item) => item.lemma).slice(0, KNOWN_WORDS),
    utterance: input.utterance.trim(),
    attempt: (session.failedAttempts[session.nodeId] ?? 0) + 1
  };
}
