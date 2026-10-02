import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config";
import { RecognitionError } from "../src/speech/providers/speech-service-stt.provider";
import { MAX_AUDIO_BYTES, RecognitionService } from "../src/speech/recognition.service";
import type { RecognitionInput, SttProvider } from "../src/speech/stt.provider";

class FakeStt implements SttProvider {
  readonly id = "fake";
  calls: RecognitionInput[] = [];
  readyChecks = 0;
  up = true;
  failWith: Error | undefined;
  async isReady() { this.readyChecks++; return this.up; }
  async transcribe(input: RecognitionInput) {
    this.calls.push(input);
    if (this.failWith) throw this.failWith;
    return { transcript: "Un café, s'il vous plaît.", speechDetected: true, confidence: 0.82 };
  }
}

const audio = Buffer.from("recording");

test("a recording becomes a transcript, with nothing about meaning attached", async () => {
  const provider = new FakeStt();
  const service = new RecognitionService(loadConfig({}), provider);
  const result = await service.transcribe({ audio, mimeType: "audio/webm", languageCode: "fr" });
  assert.deepEqual(result, { transcript: "Un café, s'il vous plaît.", speechDetected: true, confidence: 0.82 });
  assert.deepEqual(provider.calls, [{ audio, mimeType: "audio/webm", languageCode: "fr" }]);
});

test("bad recordings are rejected before the engine is asked", async () => {
  const provider = new FakeStt();
  const service = new RecognitionService(loadConfig({}), provider);
  await assert.rejects(service.transcribe({ languageCode: "fr" }), { status: 400 });
  await assert.rejects(service.transcribe({ audio: Buffer.alloc(0), languageCode: "fr" }), { status: 400 });
  await assert.rejects(service.transcribe({ audio, languageCode: "xx" }), { status: 400 });
  await assert.rejects(service.transcribe({ audio }), { status: 400 });
  await assert.rejects(service.transcribe({ audio: Buffer.alloc(MAX_AUDIO_BYTES + 1), languageCode: "fr" }), { status: 413 });
  assert.equal(provider.calls.length, 0);
});

test("engine failures become clear statuses, not crashes", async () => {
  const provider = new FakeStt();
  const service = new RecognitionService(loadConfig({}), provider);
  provider.failWith = new RecognitionError("the audio could not be decoded", 422);
  await assert.rejects(service.transcribe({ audio, languageCode: "fr" }), { status: 400 });
  provider.failWith = new RecognitionError("audio is 25 s; the limit is 20 s", 413);
  await assert.rejects(service.transcribe({ audio, languageCode: "fr" }), { status: 413 });
  provider.failWith = new RecognitionError("the speech service is not reachable", 503);
  await assert.rejects(service.transcribe({ audio, languageCode: "fr" }), { status: 503 });
  provider.failWith = new Error("anything else");
  await assert.rejects(service.transcribe({ audio, languageCode: "fr" }), { status: 503 });
});

test("readiness is checked sparingly and refreshed after a failure", async () => {
  const provider = new FakeStt();
  const service = new RecognitionService(loadConfig({}), provider);
  assert.equal(await service.ready(1000), true);
  assert.equal(await service.ready(2000), true);
  assert.equal(provider.readyChecks, 1, "cached for a few seconds");
  provider.up = false;
  assert.equal(await service.ready(9000), false);
  assert.equal(provider.readyChecks, 2);

  provider.up = true;
  provider.failWith = new RecognitionError("down", 503);
  await assert.rejects(service.transcribe({ audio, languageCode: "fr" }));
  assert.equal(await service.ready(9100), true, "a failed call clears the cached answer");
  assert.equal(provider.readyChecks, 3);
});
