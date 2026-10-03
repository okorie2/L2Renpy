// Run one TypeScript tool with the project's own build setup: node tools/run-ts.mjs tools/voice-lines.ts [args]
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "vite";

const [entry, ...args] = process.argv.slice(2);
const directory = await mkdtemp(join(tmpdir(), "second-language-tool-"));
try {
  const name = basename(entry, ".ts");
  await build({
    configFile: false,
    logLevel: "error",
    build: {
      outDir: directory,
      emptyOutDir: false,
      lib: { entry: { [name]: resolve(entry) }, formats: ["es"], fileName: (_format, chunk) => `${chunk}.mjs` },
      rollupOptions: { external: [/^node:/], output: { chunkFileNames: "chunks/[name]-[hash].mjs" } }
    }
  });
  const result = spawnSync(process.execPath, [join(directory, `${name}.mjs`), ...args], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
