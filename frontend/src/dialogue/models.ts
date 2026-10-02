import type { CharacterExpression } from "../characters/types";
import type { Condition } from "../core/models";
import type { LanguageConceptId } from "../learning/models";

/**
 * Parts of a line that must not be graded as target-language production: personal
 * names, place names, brands, foreign words, or any other dynamic story value.
 * Entries are slot names used in the line's `targetText`.
 */
export interface LineAssessment {
  excludedSpans: string[];
}

export interface ChoiceOption {
  value: string;
  label: string;
  /** Semantic icon ID; the UI decides how to draw it. */
  icon?: string;
  /** Continue here instead of the node's usual next node. */
  nextNodeId?: string;
}

/** Something the player could say. `text` may contain `{slot}` markers. */
export interface SayOption {
  id: string;
  text: string;
  translation?: string;
}

/** Something the player could do in the scene, such as handing over an amount. */
export interface ActOption {
  id: string;
  label: string;
  correct: boolean;
}

/** What the player is asked to do before the dialogue continues. */
export type DialogueResponse =
  | { kind: "text"; saveTo: "displayName"; label: string; placeholder?: string; note?: string }
  | { kind: "choice"; saveTo: "targetLanguageExperience" | "motivation"; options: ChoiceOption[] }
  | {
      /**
       * The player's turn to speak. Speaking, typing or picking a suggestion all
       * produce an utterance that is assessed for the intent, never for exact wording.
       */
      kind: "say";
      /** Stable ID the server can later use to look up canonical exercise data. */
      exerciseId: string;
      intentId: string;
      prompt: string;
      /** Suggestions shown as support; may include ones that do not fit, to be told apart. */
      options?: SayOption[];
      /** Where the other speaker reacts when the meaning did not come across. */
      repairNodeId?: string;
    }
  | {
      /** An in-scene action that shows understanding, such as paying the right price. */
      kind: "act";
      conceptId: LanguageConceptId;
      prompt: string;
      options: ActOption[];
      repairNodeId?: string;
    };

/** A consequence of completing a line. Applied once per save. */
export type DialogueEffect = { type: "GIVE_ITEM"; itemId: string; quantity?: number };

/** `speakerId` for lines the player says. Every other speaker is an NPC ID. */
export const PLAYER_SPEAKER_ID = "player";

export interface DialogueNode {
  id: string;
  speakerId: string;
  /**
   * Canonical target-language text; `{slot}` markers are filled at presentation time.
   * On the player's turn it is the model answer, shown or withheld by the support level.
   */
  targetText: string;
  translation?: string;
  /** Where to go next. Without it, and with no matching branch, the dialogue ends. */
  nextNodeId?: string;
  /** Checked in order before `nextNodeId`; the first whose conditions all hold wins. */
  branches?: Array<{ when: Condition[]; nextNodeId: string }>;
  /** Concepts this line exposes. Vocabulary is detected from the text itself. */
  conceptIds: LanguageConceptId[];
  /** Semantic pose for the conversation partner; never a filename. */
  presentation?: { expression?: CharacterExpression };
  /** Target-language scaffold such as "Je m'appelle ____." */
  hint?: string;
  assessment?: LineAssessment;
  response?: DialogueResponse;
  effects?: DialogueEffect[];
}

export interface Dialogue {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}
