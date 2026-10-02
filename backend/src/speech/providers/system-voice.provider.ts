import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SynthesisInput, SynthesisOutput, TtsProvider } from "../tts.provider";

const run = promisify(execFile);
const WORDS_PER_MINUTE = { normal: 165, slow: 115 };

/**
 * Development provider: the voices built into macOS (`say`). Free, local, and no
 * credentials, so the whole speech path works on a developer machine. It is not
 * a production voice and does not exist on Linux servers.
 */
export class SystemVoiceProvider implements TtsProvider {
  readonly id = "system";
  readonly model = "macos-say";
  private voices = new Set<string>();

  async warmUp(): Promise<void> {
    const { stdout } = await run("say", ["-v", "?"]);
    this.voices = new Set(
      stdout.split("\n").map((line) => /^(.+?)\s+[a-z]{2}_[A-Z]{2}\s+#/.exec(line)?.[1]).filter((name): name is string => Boolean(name))
    );
    if (this.voices.size === 0) throw new Error("No system voices are installed");
  }

  hasVoice(voice: string): boolean {
    return this.voices.has(voice);
  }

  async synthesize(input: SynthesisInput): Promise<SynthesisOutput> {
    const directory = await mkdtemp(join(tmpdir(), "second-language-tts-"));
    const file = join(directory, "line.wav");
    try {
      // Arguments are passed as a list, never through a shell, so the text cannot run anything.
      await run("say", ["-v", input.voice, "-r", String(WORDS_PER_MINUTE[input.rate]), "-o", file, "--data-format=LEI16@22050", "--", input.text]);
      return { audio: await readFile(file), mimeType: "audio/wav" };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
