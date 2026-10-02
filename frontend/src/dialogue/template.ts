import type { PlayerProfile } from "../core/models";
import type { DialogueNode } from "./models";

export interface LocalizedText {
  target: string;
  translation: string;
}

/**
 * Where a `{slot}` value comes from. Personal values (`profile`) are stored with the
 * player; `profile-lookup` picks canonical pack text using a profile answer; `literal`
 * names fixed spans such as a brand or place so they can be excluded from assessment.
 */
export type SlotDefinition =
  | { source: "profile"; field: "displayName"; fallback: LocalizedText }
  | {
      source: "profile-lookup";
      field: "targetLanguageExperience" | "motivation";
      options: Record<string, LocalizedText>;
      fallbackOption: string;
    }
  | { source: "literal"; value: LocalizedText };

export type SlotValues = Record<string, LocalizedText>;

export interface ResolvedSpan {
  slot: string;
  start: number;
  end: number;
  /** False when assessment must skip this span. */
  scored: boolean;
}

export interface ResolvedText {
  text: string;
  spans: ResolvedSpan[];
}

export interface ResolvedLine {
  target: ResolvedText;
  translation?: ResolvedText;
}

const SLOT_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export function templateSlots(template: string): string[] {
  return [...new Set([...template.matchAll(SLOT_PATTERN)].map((match) => match[1]))];
}

export function buildSlotValues(slots: Record<string, SlotDefinition>, profile: PlayerProfile): SlotValues {
  const values: SlotValues = {};
  for (const [name, slot] of Object.entries(slots)) {
    if (slot.source === "literal") {
      values[name] = slot.value;
    } else if (slot.source === "profile") {
      const value = profile[slot.field];
      values[name] = value ? { target: value, translation: value } : slot.fallback;
    } else {
      values[name] = slot.options[profile[slot.field] ?? ""] ?? slot.options[slot.fallbackOption];
    }
  }
  return values;
}

/** Fill `{slot}` markers and report where each value landed. Unknown slots stay literal. */
export function resolveTemplate(template: string, values: Record<string, string>, excludedSlots: string[] = []): ResolvedText {
  const spans: ResolvedSpan[] = [];
  let text = "";
  let cursor = 0;
  for (const match of template.matchAll(SLOT_PATTERN)) {
    const slot = match[1];
    const value = values[slot];
    if (value === undefined) continue;
    text += template.slice(cursor, match.index);
    spans.push({ slot, start: text.length, end: text.length + value.length, scored: !excludedSlots.includes(slot) });
    text += value;
    cursor = match.index + match[0].length;
  }
  return { text: text + template.slice(cursor), spans };
}

function pick(values: SlotValues, key: keyof LocalizedText): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value[key]]));
}

export function resolveDialogueLine(node: DialogueNode, values: SlotValues): ResolvedLine {
  return {
    target: resolveTemplate(node.targetText, pick(values, "target"), node.assessment?.excludedSpans),
    translation: node.translation === undefined ? undefined : resolveTemplate(node.translation, pick(values, "translation"))
  };
}
