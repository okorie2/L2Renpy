import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface CachedSpeech {
  audio: Buffer;
  mimeType: string;
  mouthTimeline?: string;
}

/** Generated speech on disk. One audio file and one small metadata file per line. */
export class TtsCache {
  constructor(private readonly directory: string | undefined) {}

  async get(key: string): Promise<CachedSpeech | undefined> {
    if (!this.directory) return undefined;
    try {
      const meta = JSON.parse(await readFile(join(this.directory, `${key}.json`), "utf8")) as Omit<CachedSpeech, "audio">;
      return { ...meta, audio: await readFile(join(this.directory, `${key}.bin`)) };
    } catch {
      return undefined;
    }
  }

  async set(key: string, speech: CachedSpeech): Promise<void> {
    if (!this.directory) return;
    await mkdir(this.directory, { recursive: true });
    // Write the audio first and the metadata last, each through a rename, so a
    // reader never sees a half-written entry.
    const audioFile = join(this.directory, `${key}.bin`);
    const metaFile = join(this.directory, `${key}.json`);
    await writeFile(`${audioFile}.tmp`, speech.audio);
    await rename(`${audioFile}.tmp`, audioFile);
    await writeFile(`${metaFile}.tmp`, JSON.stringify({ mimeType: speech.mimeType, mouthTimeline: speech.mouthTimeline }));
    await rename(`${metaFile}.tmp`, metaFile);
  }
}
