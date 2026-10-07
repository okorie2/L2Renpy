import assert from "node:assert/strict";
import test from "node:test";
import { wordAt } from "../src/app/voice";
import { readWordTimings } from "../src/speech/httpTts";
import {
  ALL_PRACTICE_PHRASES, MAX_WORD_ATTEMPTS, PRACTICE_PHRASES, createPhrasePicker, feedbackKind, practiceSpeech, practiceTarget, typedLineMatches,
  recordAttempt, startPractice, wordContext, type PhraseKind, type PracticeResult
} from "../src/speech/practice";
import { findRecording, RECORDED_LINES, withRecordings } from "../src/speech/recordings";

const lines = ["Je m'appelle Ella.", "Je voudrais apprendre à parler français pour ma carrière."];
const result = (similarity: number, weakest?: string): PracticeResult => ({
  similarity,
  words: [],
  weakestWord: weakest ? { index: 1, word: weakest, scored: true, needsPractice: true, phoneticGuide: "mah-pehl" } : null
});
/** A picker that names the kind it was asked for, to check which kind of phrase Sophie says. */
const kinds: (kind: PhraseKind) => string = (kind) => `<${kind}>`;
const said = (items: ReturnType<typeof practiceSpeech>) => items.map((item) => item.text);

test("a clear line: praise that fits how good it was, then the next line", () => {
  const next = recordAttempt(startPractice(), result(0.9), lines.length, lines);
  assert.equal(next.lineIndex, 1);
  assert.deepEqual(said(practiceSpeech(next, lines, kinds)), ["<clear>", lines[1]]);
  assert.deepEqual(said(practiceSpeech(recordAttempt(startPractice(), result(0.97), lines.length, lines), lines, kinds)), ["<excellent>", lines[1]]);
});

test("feedback follows how close the attempt was", () => {
  assert.equal(feedbackKind(0.98, 0.85), "excellent");
  assert.equal(feedbackKind(0.88, 0.85), "clear");
  assert.equal(feedbackKind(0.78, 0.85), "close");
  assert.equal(feedbackKind(0.6, 0.85), "goodTry");
  assert.equal(feedbackKind(0.3, 0.85), "tricky");
  assert.equal(feedbackKind(null, 0.85), "goodTry");
});

test("a missed line: feedback, the part to practise in its sentence, then the whole line once more, then on", () => {
  let state = recordAttempt(startPractice(), result(0.5, "m'appelle"), lines.length, lines);
  assert.deepEqual(said(practiceSpeech(state, lines, kinds)), ["<goodTry>", "<practisePart>", "m'appelle"]);
  const word = practiceSpeech(state, lines, kinds).at(-1)!;
  assert.deepEqual(word.kind === "target" && word.context, { before: "Je", after: "Ella." }, "the word is said as part of its sentence");
  assert.equal(practiceTarget(state, lines)?.guide, undefined, "no sounding-out guide at first");

  state = recordAttempt(state, result(0.75), lines.length, lines);
  assert.deepEqual(said(practiceSpeech(state, lines, kinds)), ["<close>", "<sayAgain>", "m'appelle"]);
  state = recordAttempt(state, result(0.4), lines.length, lines);
  assert.equal(practiceTarget(state, lines)?.guide, "mah-pehl", "the guide comes on the third try");
  state = recordAttempt(state, result(0.4), lines.length, lines);
  assert.equal(state.wordAttempts, MAX_WORD_ATTEMPTS);
  assert.deepEqual(said(practiceSpeech(state, lines, kinds)), ["<tricky>", "<wholeAgain>", lines[0]]);

  // The last go at the whole line moves on however it goes: the practice always ends.
  state = recordAttempt(state, result(0.5, "m'appelle"), lines.length, lines);
  assert.equal(state.lineIndex, 1);
  assert.deepEqual(said(practiceSpeech(state, lines, kinds)), ["<goodTry>", "<movingOn>", lines[1]]);
  state = recordAttempt(state, result(0.9), lines.length, lines);
  assert.equal(state.done, true);
  assert.deepEqual(said(practiceSpeech(state, lines, kinds)), ["<clear>"]);
  assert.deepEqual(state.outcomes, ["practised", "clear"]);
});

test("Sophie varies what she says and does not repeat herself", () => {
  const pick = createPhrasePicker();
  const goodTries = Array.from({ length: 12 }, () => pick("goodTry"));
  for (let index = 1; index < goodTries.length; index++) assert.notEqual(goodTries[index], goodTries[index - 1], "never the same twice running");
  assert.equal(new Set(goodTries.slice(0, 2)).size, 2);
  assert.ok(new Set(goodTries).size >= 3, "she uses several wordings");
  for (const phrase of goodTries) assert.ok((PRACTICE_PHRASES.goodTry as readonly string[]).includes(phrase));
  assert.ok(ALL_PRACTICE_PHRASES.length > 30);
});

test("a word's context is the sentence around it", () => {
  assert.deepEqual(wordContext("Mon niveau actuel en français est débutant.", "français"), { before: "Mon niveau actuel en", after: "est débutant." });
  assert.deepEqual(wordContext("Je voudrais apprendre à parler français pour voyager.", "Je", 0), { before: "", after: "voudrais apprendre à parler français pour voyager." });
  assert.equal(wordContext("Bonjour.", "merci"), undefined);
});

test("prompts are in the learner's language and the lines to copy are French", () => {
  const next = recordAttempt(startPractice(), result(0.5, "m'appelle"), lines.length, lines);
  assert.deepEqual(practiceSpeech(next, lines, kinds).map((item) => item.kind), ["prompt", "prompt", "target"]);
});

test("word timings from the backend are read safely, and the spoken word is found by time", () => {
  const words = readWordTimings("0:2:0:200;3:12:250:900;13:17:950:1300", 18)!;
  assert.deepEqual(words[1], { start: 3, end: 12, from: 0.25, to: 0.9 });
  assert.equal(readWordTimings("0:2:0:200;3:99:250:900", 18), undefined, "beyond the text");
  assert.equal(readWordTimings("nonsense", 18), undefined);
  assert.equal(readWordTimings(null, 18), undefined);

  assert.equal(wordAt(words, 0.1), 0);
  assert.equal(wordAt(words, 0.3), 1);
  assert.equal(wordAt(words, 2), 2, "after the last word, the last word");
  assert.equal(wordAt(words, -1), undefined);
});

test("Sophie's welcome plays from the recordings shipped with the game", async () => {
  const recorded = findRecording(RECORDED_LINES, { text: "Hi! I'm Sophie.", languageCode: "en", speakerId: "sophie" });
  assert.ok(recorded);
  const fetched: string[] = [];
  const provider = withRecordings(undefined, RECORDED_LINES, (path) => `/assets/${path}`, async (url) => {
    fetched.push(url);
    return new Response(new Uint8Array([1, 2, 3]));
  });
  const speech = await provider.synthesize({ text: "Hi! I'm Sophie.", languageCode: "en", speakerId: "sophie" });
  assert.deepEqual(fetched, ["/assets/voices/sophie/en/hi-im-sophie.mp3"]);
  assert.equal(speech.audio.mimeType, "audio/mpeg");
  assert.equal(speech.audio.data.type, "audio/mpeg", "labelled, so iOS will play it");
  assert.equal(speech.mouthTimeline?.framesPerSecond, 20);
  await assert.rejects(provider.synthesize({ text: "Something else", languageCode: "en", speakerId: "sophie" }));
});

import { chapterOneMessages, chapterOneNpcs } from "../src/content/chapter1";
import { french } from "../src/languages/fr";
import { createVoicePack, expandTemplate, voicePackLines } from "../src/speech/voicePack";

test("the voice pack holds every line that is the same for everyone, and nothing personal", () => {
  assert.deepEqual(expandTemplate("Enchantée, {playerName} !", french.slots), [], "a line with the player's name is made live");
  assert.equal(expandTemplate("{levelSentence}", french.slots).length, 3, "fixed choices are all packed");
  assert.equal(expandTemplate("{motivationSentence}", french.slots).length, 5);

  const dialogueSpeakers: Record<string, string> = {};
  for (const npc of chapterOneNpcs) for (const rule of npc.dialogues) dialogueSpeakers[rule.dialogueId] = npc.id;
  for (const thread of chapterOneMessages) dialogueSpeakers[thread.dialogueId] = thread.contactId;
  const lines = voicePackLines(french, { interfaceLanguageCode: "en", dialogueSpeakers, recorded: RECORDED_LINES });
  const has = (speakerId: string | undefined, languageCode: string, text: string, rate = "normal") =>
    lines.some((line) => line.speakerId === speakerId && line.languageCode === languageCode && line.text === text && line.rate === rate);

  assert.ok(has("sophie", "fr", "Mon niveau actuel en français est débutant."), "practice lines");
  assert.ok(has("sophie", "fr", "Mon niveau actuel en français est débutant.", "slow"), "and their slower versions");
  assert.ok(has("sophie", "fr", "m'appelle"), "practice words, even from a line with a name in it");
  for (const phrase of ALL_PRACTICE_PHRASES) assert.ok(has("sophie", "en", phrase), `Sophie's phrase: ${phrase}`);
  assert.ok(!has("sophie", "en", PRACTICE_PHRASES.goodTry[0], "slow"), "no slower English");
  const word = lines.find((line) => line.text === "m'appelle" && line.rate === "normal");
  assert.deepEqual(word?.context, { before: "Je", after: "Marie." }, "a packed word is said within a sentence");
  assert.ok(has("barista", "fr", "Vous désirez ?"), "other characters' lines");
  assert.ok(!has("sophie", "en", "Hi! I'm Sophie."), "recorded lines are already shipped");
  assert.ok(!lines.some((line) => line.text.includes("{")), "no unfilled slots");
});

test("packed lines play from the app's own files, with their word timings", async () => {
  const fetched: string[] = [];
  const fetchImpl = async (url: string) => {
    fetched.push(url);
    if (url.endsWith("manifest.json")) {
      return Response.json([{ speakerId: "sophie", languageCode: "fr", text: "Salut !", rate: "normal", file: "abc.mp3", mouth: "0110", words: [[0, 5, 0, 400]] }]);
    }
    return new Response(new Uint8Array([1, 2, 3]));
  };
  const pack = createVoicePack((path) => `/assets/${path}`, fetchImpl);
  const fallback = { providerId: "backend", synthesize: async () => { throw new Error("the backend was asked"); } };
  const provider = withRecordings(fallback, [], (path) => `/assets/${path}`, fetchImpl, pack);

  assert.equal(pack.has({ speakerId: "sophie", languageCode: "fr", text: "Salut !" }), false, "unknown until the manifest has loaded");
  const speech = await provider.synthesize({ text: "Salut !", languageCode: "fr", speakerId: "sophie" });
  assert.deepEqual(fetched, ["/assets/voices/pack/manifest.json", "/assets/voices/pack/abc.mp3"]);
  assert.deepEqual(speech.words, [{ start: 0, end: 5, from: 0, to: 0.4 }]);
  assert.equal(speech.audio.mimeType, "audio/mpeg");
  assert.equal(pack.has({ speakerId: "sophie", languageCode: "fr", text: "Salut !" }), true);
  await assert.rejects(provider.synthesize({ text: "Salut !", languageCode: "fr", speakerId: "sophie", rate: "slow" }), /backend was asked/);
});

test("recorded lines are traced with the word timings the pack holds for them", async () => {
  const fetchImpl = async (url: string) => {
    if (url.endsWith("recordings.json")) return Response.json({ "voices/sophie/en/hi-im-sophie.mp3": [[0, 3, 0, 300], [4, 7, 350, 600], [8, 15, 600, 1100]] });
    if (url.endsWith("manifest.json")) return Response.json([]);
    return new Response(new Uint8Array([1]));
  };
  const pack = createVoicePack((path) => `/assets/${path}`, fetchImpl);
  const provider = withRecordings(undefined, RECORDED_LINES, (path) => `/assets/${path}`, fetchImpl, pack);
  const speech = await provider.synthesize({ text: "Hi! I'm Sophie.", languageCode: "en", speakerId: "sophie" });
  assert.deepEqual(speech.words?.map((word) => "Hi! I'm Sophie.".slice(word.start, word.end)), ["Hi!", "I'm", "Sophie."]);
});

import { practiceExpression } from "../src/speech/practice";

test("Sophie's gesture follows what she says during practice, and she listens on the learner's turn", () => {
  assert.equal(practiceExpression(undefined, "fr"), "listening");
  assert.equal(practiceExpression({ text: "Je m'appelle Ella.", languageCode: "fr" }, "fr"), "speaking-french");
  assert.equal(practiceExpression({ text: PRACTICE_PHRASES.excellent[0], languageCode: "en" }, "fr"), "excellent");
  assert.equal(practiceExpression({ text: PRACTICE_PHRASES.clear[1], languageCode: "en" }, "fr"), "well-done");
  assert.equal(practiceExpression({ text: PRACTICE_PHRASES.close[0], languageCode: "en" }, "fr"), "close");
  assert.equal(practiceExpression({ text: PRACTICE_PHRASES.goodTry[0], languageCode: "en" }, "fr"), "good-try");
  assert.equal(practiceExpression({ text: PRACTICE_PHRASES.sayAgain[0], languageCode: "en" }, "fr"), "beckoning");
  assert.equal(practiceExpression({ text: "Something new", languageCode: "en" }, "fr"), "talking");
});

import { practiceChunk } from "../src/speech/practice";

test("a short word is practised with its neighbour, so there is enough to hear", () => {
  const line = "Je voudrais apprendre le français pour mes études.";
  const je = practiceChunk(line, "Je", 0);
  assert.equal(je.text, "Je voudrais");
  assert.equal(je.text.slice(je.focus.start, je.focus.end), "Je");
  assert.equal(je.focusIndex, 0);
  assert.deepEqual(je.context, { before: "", after: "apprendre le français pour mes études." });

  const mes = practiceChunk(line, "mes", 6);
  assert.equal(mes.text, "mes études");
  assert.equal(mes.text.slice(mes.focus.start, mes.focus.end), "mes");

  // At the end of a line the word before keeps it company.
  const end = practiceChunk("Je vais au parc", "parc", 3);
  assert.equal(end.text, "au parc");
  assert.equal(end.focusIndex, 1);
  assert.equal(practiceChunk("Il est là", "là", 2).text, "Il est là", "and one more before, when that is still short");

  // Two short words together are still too little: one more is added.
  const short = practiceChunk("Je ne sais pas.", "Je", 0);
  assert.equal(short.text, "Je ne sais");

  // A longer word is clear enough on its own.
  const long = practiceChunk(line, "apprendre", 2);
  assert.equal(long.text, "apprendre");
  assert.equal(long.focusIndex, 0);
});

test("a practised chunk is judged by the weak word in it", () => {
  const line = ["Je voudrais apprendre le français."];
  const weak = (similarity: number): PracticeResult => ({
    similarity,
    words: [],
    weakestWord: { index: 0, word: "Je", scored: true, needsPractice: true, score: 0.4 }
  });
  let state = recordAttempt(startPractice(), weak(0.5), 1, line);
  assert.equal(state.word?.text, "Je voudrais");
  assert.deepEqual(practiceTarget(state, line)?.focus, { start: 0, end: 2 });
  assert.equal(practiceSpeech(state, line, kinds).at(-1)?.text, "Je voudrais", "Sophie says the chunk");

  // The chunk as a whole sounds fine, but "Je" still does not: not yet.
  const attempt = (jeScore: number, similarity: number): PracticeResult => ({
    similarity,
    words: [
      { index: 0, word: "Je", scored: true, needsPractice: jeScore < 0.8, score: jeScore },
      { index: 1, word: "voudrais", scored: true, needsPractice: false, score: 0.95 }
    ],
    weakestWord: null
  });
  state = recordAttempt(state, attempt(0.5, 0.86), 1, line);
  assert.equal(state.feedback?.kind, "word-again");
  assert.equal(state.lastSimilarity, 0.5, "feedback follows the weak word");
  // Now "Je" comes through, even if the whole chunk is a little rough.
  state = recordAttempt(state, attempt(0.9, 0.7), 1, line);
  assert.equal(state.feedback?.kind, "word-clear");
});

test("without a microphone, a typed line counts when it has the line's words, accents and punctuation aside", () => {
  assert.ok(typedLineMatches("je m appelle Ella", "Je m'appelle Ella.", ["Ella"]));
  assert.ok(typedLineMatches("Mon niveau actuel en francais est debutant", "Mon niveau actuel en français est débutant.", []));
  assert.ok(!typedLineMatches("bonjour", "Je m'appelle Ella.", ["Ella"]));
  assert.ok(typedLineMatches("je m'appelle Sam", "Je m'appelle Ella.", ["Ella"]), "the name isn't graded");
});
