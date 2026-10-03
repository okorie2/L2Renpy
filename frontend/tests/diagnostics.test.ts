import assert from "node:assert/strict";
import test from "node:test";
import { BackendError, clearLog, formatLog, logEntries } from "../src/diagnostics/log";
import { createHttpTextToSpeech } from "../src/speech/httpTts";
import { VoiceLibrary } from "../src/speech/voiceLibrary";

const failing = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

test("a failed line carries the backend's reason and the request id, and lands in the log", async () => {
  clearLog();
  const sent: string[] = [];
  const tts = createHttpTextToSpeech("http://api.test", async (_url, init) => {
    sent.push(new Headers(init?.headers).get("X-Request-Id") ?? "");
    return failing(502, { detail: "ElevenLabs refused the request (401, quota_exceeded): no credits", requestId: "srv1" });
  });
  await assert.rejects(tts.synthesize({ text: "Bonjour", languageCode: "fr" }), (error: unknown) => {
    assert.ok(error instanceof BackendError);
    assert.equal(error.status, 502);
    assert.match(error.reason ?? "", /quota_exceeded/);
    assert.equal(error.requestId, "srv1");
    return true;
  });
  assert.equal(sent.length, 1, "a refused request is not repeated");
  assert.ok(sent[0].length >= 6, "every request has an id");

  const library = new VoiceLibrary(tts);
  assert.equal(await library.get({ text: "Bonjour tout le monde", languageCode: "fr", rate: "normal" }), undefined);
  const entry = logEntries().at(-1)!;
  assert.equal(entry.area, "voice");
  assert.match(entry.message, /Bonjour tout le monde/);
  assert.match(entry.detail ?? "", /502 .*quota_exceeded.*request srv1/);
  assert.match(formatLog(), /WARNING \[voice\]/);
  assert.equal(library.available, true, "one line that failed does not silence the next ones");
});

test("when the voice service is busy, the line is asked for once more", async () => {
  let calls = 0;
  const tts = createHttpTextToSpeech("http://api.test", async () => {
    calls++;
    return calls === 1
      ? failing(503, { detail: "busy", requestId: "a" }, { "Retry-After": "0.01" })
      : new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/mpeg" } });
  });
  const speech = await tts.synthesize({ text: "Salut", languageCode: "fr" });
  assert.equal(calls, 2);
  assert.equal(speech.audio.mimeType, "audio/mpeg");
});

test("an unreachable backend is left alone for a while", async () => {
  clearLog();
  let now = 0;
  const library = new VoiceLibrary({ providerId: "backend", synthesize: async () => { throw new TypeError("Load failed"); } }, { now: () => now });
  assert.equal(await library.get({ text: "Salut", languageCode: "fr", rate: "normal" }), undefined);
  assert.equal(library.available, false);
  assert.match(logEntries().at(-1)?.detail ?? "", /could not be reached/);
  now = 10_001;
  assert.equal(library.available, true);
});
