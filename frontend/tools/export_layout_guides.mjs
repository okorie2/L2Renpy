// Draw a layout guide for every location, from the game's own data, into tools/guides/.
// A guide shows where the solid things, doors, signs and people are, so a painted
// backdrop can be made to line up with the world. Needs Python with Pillow:
//   PYTHON=/path/to/python node tools/export_layout_guides.mjs
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "vite";

const directory = await mkdtemp(join(tmpdir(), "second-language-guides-"));
try {
  await build({
    configFile: false,
    logLevel: "error",
    build: {
      outDir: directory,
      emptyOutDir: false,
      lib: { entry: { layouts: "tools/layout-data.ts" }, formats: ["es"], fileName: (_format, name) => `${name}.mjs` },
      rollupOptions: { external: [/^node:/, "phaser"] }
    }
  });
  const { layouts } = await import(pathToFileURL(join(directory, "layouts.mjs")).href);
  const data = join(directory, "layouts.json");
  await writeFile(data, JSON.stringify(layouts));
  const result = spawnSync(process.env.PYTHON ?? "python3", ["tools/draw_layout_guides.py", data, "tools/guides"], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
