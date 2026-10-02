import type { Dialogue } from "../dialogue/models";
import type { SlotDefinition } from "../dialogue/template";
import type { ConversationIntent, LanguageConceptId, VocabularyItem } from "../learning/models";

export interface LanguagePack {
  code: string;
  name: string;
  ui: {
    interact: string;
  };
  placeLabels: Record<string, string>;
  conceptExpressions: Record<LanguageConceptId, string[]>;
  vocabulary: VocabularyItem[];
  intents: Record<string, ConversationIntent>;
  /** Named `{slot}` values dialogue lines may use; personal values never live in the pack. */
  slots: Record<string, SlotDefinition>;
  dialogues: Record<string, Dialogue>;
}
