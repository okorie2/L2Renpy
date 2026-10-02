import { french } from "./fr";
import type { LanguagePack } from "./types";

export const languagePacks: Record<string, LanguagePack> = {
  [french.code]: french
};

// A language selector can replace this default without changing core or Phaser code.
export const activeLanguagePack = languagePacks.fr;
