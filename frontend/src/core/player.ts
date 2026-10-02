import type { GameSave, LearningMotivation, PlayerProfile, TargetLanguageExperience } from "./models";

export const DISPLAY_NAME_MAX_LENGTH = 30;
const EXPERIENCES: TargetLanguageExperience[] = ["new", "some", "conversational"];
const MOTIVATIONS: LearningMotivation[] = ["travel", "work", "study", "people", "curiosity"];

/** Names are free text shown inside dialogue, so strip anything that could act as markup. */
export function sanitizeDisplayName(raw: string): string | undefined {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f{}<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH)
    .trim();
  return cleaned || undefined;
}

/** Apply one profile answer; unknown fields or values leave the save untouched. */
export function updatePlayerProfile(save: GameSave, field: keyof PlayerProfile, value: string): GameSave {
  let patch: PlayerProfile | undefined;
  if (field === "displayName") {
    const displayName = sanitizeDisplayName(value);
    if (displayName) patch = { displayName };
  } else if (field === "targetLanguageExperience") {
    const experience = EXPERIENCES.find((item) => item === value);
    if (experience) patch = { targetLanguageExperience: experience };
  } else if (field === "motivation") {
    const motivation = MOTIVATIONS.find((item) => item === value);
    if (motivation) patch = { motivation };
  }
  if (!patch) return save;

  return {
    ...save,
    player: { ...save.player, profile: { ...save.player.profile, ...patch } }
  };
}
