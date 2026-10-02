import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig, type AppConfig } from "../src/config";
import { ttsCacheKey } from "../src/speech/cache-key";
import { mouthTimeline } from "../src/speech/mouth-timeline";
import { MAX_TEXT_LENGTH, SpeechService } from "../src/speech/speech.service";
import type { SynthesisInput, TtsProvider } from "../src/speech/tts.provider";

/** 16-bit mono WAV with a JUNK chunk before `fmt `, as macOS writes it. */
function wav(samples: number[], sampleRate = 8000): Buffer {
  const junk = Buffer.alloc(8 + 28);
  junk.write("JUNK", 0, "ascii");
  junk.writeUInt32LE(28, 4);
  const fmt = Buffer.alloc(8 + 16);
  fmt.write("fmt ", 0, "ascii");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(1, 10);
  fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE(sampleRate * 2, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const data = Buffer.alloc(8 + samples.length * 2);
  data.write("data", 0, "ascii");
  data.writeUInt32LE(samples.length * 2, 4);
  samples.forEach((sample, index) => data.writeInt16LE(sample, 8 + index * 2));
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + junk.length + fmt.length + data.length, 4);
  header.write("WAVE", 8, "ascii");
  return Buffer.concat([header, junk, fmt, data]);
}

class FakeProvider implements TtsProvider {
  readonly id = "fake";
  readonly model = "v1";
  calls: SynthesisInput[] = [];
  failWarmUp = false;
  voices = new Set(["Voice A", "Voice B"]);
  async warmUp() { if (this.failWarmUp) throw new Error("no credentials"); }
  hasVoice(voice: string) { return this.voices.has(voice); }
  async synthesize(input: SynthesisInput) {
    this.calls.push(input);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { audio: wav([0, 0, 9000, -9000]), mimeType: "audio/wav" };
  }
}

async function service(overrides: Partial<AppConfig["tts"]> = {}) {
  const cacheDir = await mkdtemp(join(tmpdir(), "tts-test-"));
  const config: AppConfig = {
    ...loadConfig({}),
    tts: { provider: "fake", cacheDir, voices: { fr: { default: "Voice A", sophie: "Voice B" } }, ...overrides }
  };
  const provider = new FakeProvider();
  return { provider, cacheDir, config, create: () => new SpeechService(config, provider), cleanup: () => rm(cacheDir, { recursive: true, force: true }) };
}

test("the cache key separates provider, model, voice, language, rate and exact text", () => {
  const base = { provider: "p", model: "m", voice: "v", language: "fr", text: "Bonjour !", rate: "normal" };
  assert.equal(ttsCacheKey(base), ttsCacheKey({ ...base }));
  assert.match(ttsCacheKey(base), /^[0-9a-f]{64}$/);
  for (const change of [{ provider: "q" }, { model: "n" }, { voice: "w" }, { language: "en" }, { text: "Bonjour!" }, { rate: "slow" }]) {
    assert.notEqual(ttsCacheKey(base), ttsCacheKey({ ...base, ...change }), JSON.stringify(change));
  }
  assert.notEqual(ttsCacheKey({ ...base, provider: "a|b", model: "c" }), ttsCacheKey({ ...base, provider: "a", model: "b|c" }));
});

test("the mouth timeline follows loudness, one flag per frame", () => {
  const frame = 8000 / 20;
  const quiet = Array<number>(frame).fill(0);
  const loud = Array.from({ length: frame }, (_, i) => (i % 2 ? 12000 : -12000));
  assert.equal(mouthTimeline(wav([...quiet, ...loud, ...loud, ...quiet, ...loud]), "audio/wav"), "01101");
  assert.equal(mouthTimeline(Buffer.from("not audio"), "audio/wav"), undefined);
  assert.equal(mouthTimeline(wav(loud), "audio/mpeg"), undefined, "only formats it can read");
});

test("identical lines are synthesized once and then served from the cache", async () => {
  const { provider, create, cleanup, cacheDir } = await service();
  try {
    const speech = create();
    await speech.onModuleInit();
    assert.deepEqual(speech.readiness(), { ready: true, provider: "fake" });

    const first = await speech.synthesize({ text: "  Bonjour !  ", languageCode: "fr", speakerId: "sophie" });
    assert.equal(first.cached, false);
    assert.equal(first.mimeType, "audio/wav");
    assert.deepEqual(provider.calls, [{ text: "Bonjour !", languageCode: "fr", voice: "Voice B", rate: "normal" }]);

    const second = await speech.synthesize({ text: "Bonjour !", languageCode: "fr", speakerId: "sophie" });
    assert.equal(second.cached, true);
    assert.equal(second.cacheKey, first.cacheKey);
    assert.deepEqual(second.audio, first.audio);
    assert.equal(provider.calls.length, 1);

    // A restarted service still finds it on disk.
    const restarted = create();
    await restarted.onModuleInit();
    assert.equal((await restarted.synthesize({ text: "Bonjour !", languageCode: "fr", speakerId: "sophie" })).cached, true);
    assert.equal((await readdir(cacheDir)).length, 2);

    // Different rate, speaker or text is different speech. An unknown speaker gets the default voice.
    await speech.synthesize({ text: "Bonjour !", languageCode: "fr", speakerId: "sophie", rate: "slow" });
    await speech.synthesize({ text: "Bonjour !", languageCode: "fr", speakerId: "someone-new" });
    assert.deepEqual(provider.calls.slice(1).map((call) => [call.voice, call.rate]), [["Voice B", "slow"], ["Voice A", "normal"]]);
  } finally {
    await cleanup();
  }
});

test("simultaneous requests for the same line share one synthesis", async () => {
  const { provider, create, cleanup } = await service();
  try {
    const speech = create();
    await speech.onModuleInit();
    const results = await Promise.all(Array.from({ length: 5 }, () => speech.synthesize({ text: "Merci !", languageCode: "fr" })));
    assert.equal(provider.calls.length, 1);
    assert.equal(new Set(results.map((result) => result.cacheKey)).size, 1);
  } finally {
    await cleanup();
  }
});

test("bad requests are rejected before any provider is called", async () => {
  const { provider, create, cleanup } = await service();
  try {
    const speech = create();
    await speech.onModuleInit();
    const bad = [
      { text: "", languageCode: "fr" },
      { text: "   ", languageCode: "fr" },
      { text: "x".repeat(MAX_TEXT_LENGTH + 1), languageCode: "fr" },
      { text: "Hello", languageCode: "xx" },
      { text: "Bonjour", languageCode: "fr", rate: "fast" },
      { languageCode: "fr" }
    ];
    for (const request of bad) {
      await assert.rejects(speech.synthesize(request as never), { status: 400 }, JSON.stringify(request).slice(0, 60));
    }
    assert.equal(provider.calls.length, 0);
  } finally {
    await cleanup();
  }
});

test("a provider that cannot serve keeps the service alive but not ready", async () => {
  const failing = await service();
  const missingVoice = await service({ voices: { fr: { default: "Voice Z" } } });
  try {
    failing.provider.failWarmUp = true;
    const speech = failing.create();
    await speech.onModuleInit();
    assert.deepEqual(speech.readiness(), { ready: false, provider: "fake", reason: "no credentials" });
    await assert.rejects(speech.synthesize({ text: "Bonjour", languageCode: "fr" }), { status: 503 });

    const other = missingVoice.create();
    await other.onModuleInit();
    assert.equal(other.readiness().ready, false);
    assert.match(other.readiness().reason ?? "", /Voice Z/);

    // A list is an order of preference: the first voice the provider has is used.
    const preferred = await service({ voices: { fr: { default: ["Voice Premium", "Voice B", "Voice A"] } } });
    try {
      const speech3 = preferred.create();
      await speech3.onModuleInit();
      assert.equal(speech3.readiness().ready, true);
      await speech3.synthesize({ text: "Bonjour", languageCode: "fr" });
      assert.equal(preferred.provider.calls[0].voice, "Voice B");
    } finally {
      await preferred.cleanup();
    }
  } finally {
    await failing.cleanup();
    await missingVoice.cleanup();
  }
});

test("caching can be turned off", async () => {
  const { provider, create, cleanup } = await service({ cacheDir: undefined });
  try {
    const speech = create();
    await speech.onModuleInit();
    await speech.synthesize({ text: "Salut", languageCode: "fr" });
    assert.equal((await speech.synthesize({ text: "Salut", languageCode: "fr" })).cached, false);
    assert.equal(provider.calls.length, 2);
    assert.equal(loadConfig({ TTS_CACHE_DIR: "off" }).tts.cacheDir, undefined);
    assert.throws(() => loadConfig({ TTS_VOICES: "{nope" }), /valid JSON/);
  } finally {
    await cleanup();
  }
});
