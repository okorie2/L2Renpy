/**
 * Writes tools/voice-lines.json: every line the voice pack should hold.
 * Run with `npm run voices:list`; then `python tools/build_voice_pack.py` in backend/.
 */
import { writeFileSync } from "node:fs";
import { chapterOneMessages, chapterOneNpcs } from "../src/content/chapter1";
import { activeLanguagePack } from "../src/languages";
import { RECORDED_LINES } from "../src/speech/recordings";
import { voicePackLines } from "../src/speech/voicePack";

const dialogueSpeakers: Record<string, string> = {};
for (const npc of chapterOneNpcs) for (const rule of npc.dialogues) dialogueSpeakers[rule.dialogueId] = npc.id;
for (const thread of chapterOneMessages) dialogueSpeakers[thread.dialogueId] = thread.contactId;

const lines = voicePackLines(activeLanguagePack, { interfaceLanguageCode: "en", dialogueSpeakers, recorded: RECORDED_LINES });
writeFileSync(process.argv[2] ?? "tools/voice-lines.json", JSON.stringify(lines, null, 1) + "\n");
// The recordings shipped with the game, so the pack tool can time their words for tracing.
writeFileSync("tools/recorded-lines.json", JSON.stringify(RECORDED_LINES.map(({ path, text }) => ({ path, text })), null, 1) + "\n");
const characters = lines.reduce((sum, line) => sum + line.text.length, 0);
console.log(`${lines.length} lines, ${characters} characters (${lines.filter((line) => line.rate === "slow").length} of them slower versions)`);
