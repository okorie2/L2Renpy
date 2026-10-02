import assert from "node:assert/strict";
import test from "node:test";
import { chapterOneQuests, createStartingPlayer } from "../src/content/chapter1";
import type { GameSave } from "../src/core/models";
import { createInitialSave } from "../src/core/quests";
import { startDialogue, stepDialogue, type DialogueInput } from "../src/dialogue/engine";
import { french } from "../src/languages/fr";
import { chapterOneConcepts } from "../src/learning/concepts";
import { summarizeLearning } from "../src/learning/summary";
import { RecognitionRequestError, createHttpSpeechToText, fetchSpeechCapabilities } from "../src/speech/httpStt";
import { createHttpTextToSpeech } from "../src/speech/httpTts";
import { mouthOpenAt } from "../src/speech/mouth";
import type { SynthesisRequest, SynthesizedSpeech, TextToSpeechProvider } from "../src/speech/types";
import { VoiceLibrary } from "../src/speech/voiceLibrary";

const clip = (label: string): SynthesizedSpeech => ({ audio: { data: new Blob([label]), mimeType: "audio/wav" } });

class FakeProvider implements TextToSpeechProvider {
  readonly providerId = "fake";
  calls: SynthesisRequest[] = [];
  failing = false;
  async synthesize(request: SynthesisRequest) {
    this.calls.push(request);
    if (this.failing) throw new Error("backend is down");
    return clip(request.text);
  }
}

test("the backend adapter sends who speaks, never a voice, and reads the lip-sync track", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const provider = createHttpTextToSpeech("http://api.test/", async (url, init) => {
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(new Blob(["audio"]), {
      headers: { "Content-Type": "audio/wav", "X-Mouth-Timeline": "0110", "X-Mouth-Fps": "20" }
    });
  });
  const speech = await provider.synthesize({ text: "Bonjour !", languageCode: "fr", speakerId: "sophie", rate: "slow" });
  assert.deepEqual(requests, [{
    url: "http://api.test/speech/synthesize",
    body: { text: "Bonjour !", languageCode: "fr", speakerId: "sophie", rate: "slow" }
  }]);
  assert.equal(speech.audio.mimeType, "audio/wav");
  assert.equal(await speech.audio.data.text(), "audio");
  assert.deepEqual(speech.mouthTimeline, { frames: "0110", framesPerSecond: 20 });

  const plain = createHttpTextToSpeech("http://api.test", async () => new Response("x", { headers: { "X-Mouth-Timeline": "<script>" } }));
  assert.equal((await plain.synthesize({ text: "Salut", languageCode: "fr" })).mouthTimeline, undefined);
  const failing = createHttpTextToSpeech("http://api.test", async () => new Response("no", { status: 503 }));
  await assert.rejects(failing.synthesize({ text: "Salut", languageCode: "fr" }), /503/);
});

test("each line is fetched once, however often it is asked for", async () => {
  const provider = new FakeProvider();
  const library = new VoiceLibrary(provider);
  const line = { text: "Bonjour !", languageCode: "fr", speakerId: "barista" };
  library.prefetch(line);
  const [first, second] = await Promise.all([library.get(line), library.get({ ...line, rate: "normal" as const })]);
  assert.equal(first, second);
  assert.equal(provider.calls.length, 1);
  await library.get({ ...line, rate: "slow" });
  await library.get({ ...line, speakerId: "baker" });
  await library.get({ ...line, text: "Bonjour" });
  assert.equal(provider.calls.length, 4, "speed, speaker and wording are different speech");
});

test("a backend that is away means silence, not errors, and is retried later", async () => {
  const provider = new FakeProvider();
  let now = 1000;
  const library = new VoiceLibrary(provider, { retryAfterMs: 5000, now: () => now });
  provider.failing = true;
  assert.equal(await library.get({ text: "Salut", languageCode: "fr" }), undefined);
  assert.equal(library.available, false);
  // While backing off nothing is requested, so a dead backend cannot slow the game.
  assert.equal(await library.get({ text: "Ça va ?", languageCode: "fr" }), undefined);
  assert.equal(provider.calls.length, 1);

  provider.failing = false;
  now += 5000;
  assert.equal(library.available, true);
  assert.ok(await library.get({ text: "Salut", languageCode: "fr" }), "a failed line is not remembered as failed");
});

test("old lines are dropped and released when the library is full", async () => {
  const released: string[] = [];
  const library = new VoiceLibrary(new FakeProvider(), { capacity: 2, onEvict: (speech) => void speech.audio.data.text().then((text) => released.push(text)) });
  for (const text of ["un", "deux", "un", "trois"]) await library.get({ text, languageCode: "fr" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(released, ["deux"], "the least recently used line goes first");
});

test("the mouth follows the clip's timeline, or flaps steadily without one", () => {
  const timeline = { framesPerSecond: 20, frames: "0110" };
  assert.deepEqual([0, 0.05, 0.1, 0.15, 0.2, 5].map((seconds) => mouthOpenAt(timeline, seconds)), [false, true, true, false, false, false]);
  assert.equal(mouthOpenAt(timeline, -1), false);
  const flaps = [0, 0.1, 0.2, 0.3, 0.4].map((seconds) => mouthOpenAt(undefined, seconds));
  assert.ok(flaps.includes(true) && flaps.includes(false));
});

const context = { quests: chapterOneQuests, intents: french.intents, slots: french.slots, vocabulary: french.vocabulary, now: "2026-10-02T10:00:00.000Z" };
const cafeSave = (): GameSave => {
  const save = createInitialSave(createStartingPlayer("fr"), chapterOneQuests);
  return { ...save, player: { ...save.player, locationId: "cafe" } };
};
const cafe = french.dialogues.cafeOrder;
const at = (nodeId: string, save: GameSave, input: DialogueInput) => stepDialogue({ ...startDialogue(cafe, "barista"), nodeId }, cafe, input, save, context).save;

test("hearing a line is listening evidence, kept apart from reading", () => {
  const read = at("ask", cafeSave(), { type: "CONTINUE", assistance: [] });
  assert.equal(read.conceptMastery.ORDER_ITEM.byModality.reading?.encounters, 1);
  assert.equal(read.conceptMastery.ORDER_ITEM.byModality.listening, undefined);

  // Heard with the text on screen: read, and also exposed by ear.
  const both = at("ask", cafeSave(), { type: "CONTINUE", assistance: [], heard: true, textVisible: true });
  assert.equal(both.conceptMastery.ORDER_ITEM.byModality.reading?.encounters, 1);
  assert.equal(both.conceptMastery.ORDER_ITEM.byModality.listening?.encounters, 1);
  assert.equal(both.vocabularyMastery["fr.desirer"].byModality.listening?.encounters, 1);

  // Heard with the text held back: listening only.
  const listened = at("ask", cafeSave(), { type: "CONTINUE", assistance: [], heard: true, textVisible: false });
  assert.equal(listened.conceptMastery.ORDER_ITEM.byModality.reading, undefined);
  assert.equal(listened.conceptMastery.ORDER_ITEM.byModality.listening?.encounters, 1);

  // Text hidden but nothing was heard is not listening.
  const neither = at("ask", cafeSave(), { type: "CONTINUE", assistance: [], heard: false, textVisible: false });
  assert.equal(neither.conceptMastery.ORDER_ITEM.byModality.listening, undefined);
});

test("paying the right price after only hearing it is understanding by ear", () => {
  const pay = (input: Partial<DialogueInput>) => at("price", cafeSave(), { type: "ACT", optionId: "three", assistance: [], ...input } as DialogueInput);
  const byEar = pay({ heard: true, textVisible: false, assistance: ["replay", "slow-playback"] });
  assert.deepEqual(byEar.conceptMastery.UNDERSTAND_PRICE.byModality.listening, {
    encounters: 1, attempts: 1, successfulAttempts: 1, unsuccessfulAttempts: 0, independentSuccesses: 0, assistedEncounters: 1
  });
  assert.equal(byEar.conceptMastery.UNDERSTAND_PRICE.byModality.reading, undefined);
  assert.equal(pay({ heard: true, textVisible: false }).conceptMastery.UNDERSTAND_PRICE.byModality.listening?.independentSuccesses, 1);

  const byEye = pay({ heard: true, textVisible: true });
  assert.equal(byEye.conceptMastery.UNDERSTAND_PRICE.byModality.reading?.successfulAttempts, 1);
  assert.equal(byEye.conceptMastery.UNDERSTAND_PRICE.byModality.listening?.successfulAttempts, 0, "heard, but the success was read");

  const price = summarizeLearning(byEar, chapterOneConcepts, french.vocabulary).concepts.find((entry) => entry.concept.id === "UNDERSTAND_PRICE")!;
  assert.equal(price.understood, 1);
});

test("a recording is uploaded to the backend and comes back as words", async () => {
  const sent: Array<{ url: string; language: FormDataEntryValue | null; file: File }> = [];
  const provider = createHttpSpeechToText("http://api.test/", async (url, init) => {
    const form = init?.body as FormData;
    sent.push({ url, language: form.get("languageCode"), file: form.get("audio") as File });
    return Response.json({ transcript: " Un café, s'il vous plaît. ", speechDetected: true, confidence: 0.9 });
  });
  const clip = { data: new Blob(["recording"], { type: "audio/webm;codecs=opus" }), mimeType: "audio/webm;codecs=opus" };
  assert.deepEqual(await provider.transcribe({ audio: clip, languageCode: "fr" }), {
    transcript: "Un café, s'il vous plaît.", speechDetected: true, confidence: 0.9
  });
  assert.equal(sent[0].url, "http://api.test/speech/transcribe");
  assert.equal(sent[0].language, "fr");
  assert.equal(sent[0].file.name, "answer.webm");
  assert.equal(await sent[0].file.text(), "recording");

  const silent = createHttpSpeechToText("http://api.test", async () => Response.json({ transcript: "", speechDetected: true }));
  assert.equal((await silent.transcribe({ audio: clip, languageCode: "fr" })).speechDetected, false, "no words means no speech");
  const failing = createHttpSpeechToText("http://api.test", async () => new Response("no", { status: 503 }));
  await assert.rejects(failing.transcribe({ audio: clip, languageCode: "fr" }), (error) => error instanceof RecognitionRequestError && error.status === 503);
});

test("a backend that cannot be asked simply offers no microphone", async () => {
  assert.deepEqual(await fetchSpeechCapabilities("http://api.test/", async () => Response.json({ synthesis: true, recognition: true })), { synthesis: true, recognition: true });
  assert.deepEqual(await fetchSpeechCapabilities("http://api.test", async () => Response.json({ synthesis: true })), { synthesis: true, recognition: false });
  assert.deepEqual(await fetchSpeechCapabilities("http://api.test", async () => new Response("", { status: 500 })), { synthesis: false, recognition: false });
  assert.deepEqual(await fetchSpeechCapabilities("http://api.test", async () => { throw new Error("offline"); }), { synthesis: false, recognition: false });
});

test("a spoken answer is speaking evidence and moves the quest like any other answer", () => {
  const save = { ...cafeSave(), questProgress: { ...cafeSave().questProgress, meetSophie: { status: "completed" as const, completedObjectiveIds: [], objectiveCounts: {} }, cafe: { status: "active" as const, completedObjectiveIds: ["enterCafe", "greetBarista"], objectiveCounts: {} } } };
  const step = stepDialogue({ ...startDialogue(cafe, "barista"), nodeId: "order" }, cafe, { type: "SAY", text: "Je voudrais un café, s'il vous plaît.", mode: "speech", assistance: [] }, save, context);
  assert.equal(step.result, "advanced");
  assert.ok(step.save.questProgress.cafe.completedObjectiveIds.includes("orderDrink"));
  assert.deepEqual(step.save.conceptMastery.ORDER_ITEM.byModality.speaking, {
    encounters: 1, attempts: 1, successfulAttempts: 1, unsuccessfulAttempts: 0, independentSuccesses: 1, assistedEncounters: 0
  });
  assert.equal(step.save.conceptMastery.ORDER_ITEM.byModality.writing, undefined);
  assert.equal(step.save.vocabularyMastery["fr.jevoudrais"].byModality.speaking?.successfulAttempts, 1);
  assert.equal(summarizeLearning(step.save, chapterOneConcepts, french.vocabulary).concepts.find((entry) => entry.concept.id === "ORDER_ITEM")!.producedBySpeaking, 1);

  // A misheard or wrong answer gets the same in-scene repair, and what was heard is kept.
  const miss = stepDialogue({ ...startDialogue(cafe, "barista"), nodeId: "order" }, cafe, { type: "SAY", text: "Un thé.", mode: "speech", assistance: [] }, save, context);
  assert.equal(miss.result, "repair");
  assert.equal(miss.session.nodeId, "repairOrder");
  assert.equal(miss.session.history.at(-1)?.text, "Un thé.");
});
