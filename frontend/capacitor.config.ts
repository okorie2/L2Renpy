import { existsSync, readFileSync } from "node:fs";
import type { CapacitorConfig } from "@capacitor/cli";

/** The backend address a mobile build was made with, from the same files Vite reads in `mobile` mode. */
function mobileApiUrl(): string | undefined {
  for (const file of [".env.mobile.local", ".env.mobile"]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8").match(/^\s*VITE_API_URL\s*=\s*(\S+)/m);
    if (match) return match[1];
  }
  return undefined;
}

// A backend on a developer's own machine is plain HTTP. Android blocks that by
// default, so it is allowed only when the build actually points at one. A build
// that points at an HTTPS backend gets none of these exceptions.
const plainHttpBackend = mobileApiUrl()?.startsWith("http://") ?? false;

const config: CapacitorConfig = {
  appId: "com.psami.secondlanguage",
  appName: "Second Language",
  webDir: "dist",
  backgroundColor: "#111111",
  ...(plainHttpBackend ? { server: { cleartext: true }, android: { allowMixedContent: true } } : {})
};

export default config;
