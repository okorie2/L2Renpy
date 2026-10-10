import type { CharacterExpression, Framing } from "../characters/types";
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
  | {
      kind: "text";
      saveTo: "displayName" | "age";
      label: string;
      placeholder?: string;
      note?: string;
      /** The keyboard to offer: a number pad for the age. */
      inputMode?: "text" | "numeric";
    }
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
      /**
       * Answer out loud only: the microphone, plus an Assist button that has the
       * conversation partner say the answer (the node's `targetText`) to repeat.
       * No suggestions to pick and no typing, unless the microphone can't be used.
       */
      speakOnly?: boolean;
      /**
       * The question being answered, said and shown on this same card, so asking and
       * answering are one moment. Said by `speakerId` (default: the conversation
       * partner); its English follows `presentation.translation`.
       */
      question?: { text: string; translation?: string; speakerId?: string };
    }
  | {
      /**
       * Pronunciation practice on lines the player has just been shown: listen,
       * say it, practise the word that needs it most, then the whole line once
       * more. Attempts are finite and the player can always move on; the result
       * never decides progress. `lines` may contain `{slot}` markers; slots named in
       * the node's `assessment.excludedSpans` are not graded.
       */
      kind: "practice";
      lines: Array<{ text: string; translation?: string }>;
    }
  | {
      /**
       * A single button to carry on, such as "Let's go" at the end of a scene. It
       * asks for nothing and assesses nothing; the line simply waits for the tap.
       */
      kind: "continue";
      label: string;
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

export interface LinePresentation {
  /** Semantic pose for whoever is shown; never a filename. */
  expression?: CharacterExpression;
  framing?: Framing;
  /**
   * The painted place behind the conversation, by scene ID (see content/scenes.ts).
   * It stays until another line names a different one.
   */
  scene?: string;
  /**
   * Whose portrait is shown. Defaults to the speaker when they have one, else the
   * conversation partner; set it on the player's reply to keep the person they answer.
   */
  focus?: string;
  /**
   * A quiz, test or exercise: the learner is meant to manage alone, so the English is
   * behind a "Show translation" button instead of shown.
   */
  exercise?: boolean;
  /**
   * On a street-staged dialogue: how Sophie stands while this line is said (she keeps
   * her place on the street), and who else is there.
   */
  street?: {
    pose?: StreetPose;
    /** Sophie's pose mirrored, so she faces the other way (toward someone on her right). */
    flip?: boolean;
    /** Who Sophie and the learner are talking with: there, close by. */
    with?: string;
    /**
     * Everyone else in the shot from this line on, where they stand. Lines that don't
     * say keep whoever was there, where they were left.
     */
    people?: StreetPresence[];
  };
}

/** Where someone stands in a street shot (their places are in `STREET_PEOPLE`). */
export type StreetSpot = "far" | "near" | "passed";

/**
 * Someone in the street shot, at one of their places, or on their way from `at` to
 * `to` (over a walk, as the camera moves; on a card, while it is up). `wave` raises a
 * hand, when that pose has been drawn.
 */
export interface StreetPresence {
  id: string;
  at?: StreetSpot;
  to?: StreetSpot;
  /** On a walk: how far through it (0–1) they set off. */
  start?: number;
  wave?: boolean;
}

/**
 * Sophie's poses where she stands on the street, ahead of the camera. `glance` is
 * looking back over her shoulder; `greeting` is waving to someone passing; the rest
 * face the camera, for when she has stopped and turned round.
 */
export type StreetPose = "glance" | "greeting" | "wave" | "playful" | "explaining" | "pleased";

/**
 * A moment with no words: the camera pulls back and follows Sophie from behind as she
 * walks on, through one painted place or from one into the next. It moves on by itself.
 */
export interface WalkInterlude {
  kind: "walk";
  /**
   * The stretches walked, in order, each in one painted place. The camera keeps its
   * distance behind Sophie and moves into the painting from `zoom[0]` to `zoom[1]`:
   * that is the ground she covers. One stretch dissolves into the next.
   */
  segments: Array<{
    scene: string;
    zoom: [number, number];
    /** Who is on this stretch of street, standing in the painting or coming or going. */
    people?: StreetPresence[];
  }>;
  durationMs: number;
  /** Start close on Sophie, as on the card before, and pull back before she sets off. */
  pullBack?: boolean;
}

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
  /**
   * "interface" marks a line in the learner's own language (English), such as
   * Sophie's welcome before she starts teaching. It is shown and voiced as it is,
   * has no translation, and is not evidence of target-language learning.
   */
  language?: "interface";
  /** How the line is staged. Everything here is semantic; the UI decides how to draw it. */
  presentation?: LinePresentation;
  /** Target-language scaffold such as "Je m'appelle ____." */
  hint?: string;
  assessment?: LineAssessment;
  response?: DialogueResponse;
  effects?: DialogueEffect[];
  /** A walk with no words in place of a line. Such a node has empty text and no response. */
  interlude?: WalkInterlude;
}

export interface Dialogue {
  id: string;
  startNodeId: string;
  /**
   * Lines without an answer move on by themselves once they have been heard
   * (or, in silence, read), so a scene flows without tapping "next".
   */
  autoAdvance?: boolean;
  /**
   * `street`: the conversation happens where the characters are, as one continuous
   * shot: the place stays as the last walk left it and Sophie keeps her spot in it,
   * instead of close-ups. Used for the walk to the café.
   */
  staging?: "street";
  nodes: Record<string, DialogueNode>;
}
