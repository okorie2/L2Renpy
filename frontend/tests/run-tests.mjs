import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "vite";

const tests = (await readdir("tests")).filter((file) => file.endsWith(".test.ts")).sort();
const directory = await mkdtemp(join(tmpdir(), "second-language-tests-"));
try {
  await build({
    configFile: false,
    logLevel: "error",
    build: {
      outDir: directory,
      emptyOutDir: false,
      lib: {
        entry: Object.fromEntries(tests.map((file) => [basename(file, ".ts"), join("tests", file)])),
        formats: ["es"],
        fileName: (_format, name) => `${name}.mjs`
      },
      rollupOptions: {
        external: [/^node:/],
        // Shared modules must also be .mjs: the temp directory has no package.json.
        output: { chunkFileNames: "chunks/[name]-[hash].mjs" }
      }
    }
  });
  const outputs = tests.map((file) => join(directory, `${basename(file, ".ts")}.mjs`));
  const result = spawnSync(process.execPath, ["--test", ...outputs], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
