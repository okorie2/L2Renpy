import { resolve } from "node:path";

export interface AppConfig {
  port: number;
  corsOrigins: string[];
  speech: {
    /** Languages learners may speak. */
    languages: string[];
    /** Base URL of the speech/ML service. Only the backend talks to it. */
    serviceUrl: string;
  };
  ai: {
    /** "none" turns the AI conversation layer off; the game then uses its own rules only. */
    provider: string;
    model: string;
    /** Stays on the server. Never logged, never sent to a client. */
    apiKey?: string;
    baseUrl: string;
    timeoutMs: number;
    /** Upper bound on model calls per minute, across all players. */
    requestsPerMinute: number;
  };
  tts: {
    provider: string;
    /** Absolute cache directory, or undefined when caching is off. */
    cacheDir?: string;
    /**
     * language -> speakerId -> provider voice, or voices in order of preference: the
     * first one the provider has is used. `default` is the fallback speaker.
     */
    voices: Record<string, Record<string, string | string[]>>;
  };
}

/**
 * Development voices for the macOS system provider, best first. The plain names
 * ship with macOS; the "Enhanced" and "Premium" ones are free downloads in System
 * Settings and are picked up automatically once installed. The voices with a
 * locale in brackets, such as "Flo (French (France))", are a robotic synthesizer
 * and are deliberately not used.
 */
const FEMALE = ["Audrey (Premium)", "Audrey (Enhanced)", "Aurélie (Enhanced)", "Amélie (Premium)", "Amélie (Enhanced)", "Amélie"];
const DEFAULT_VOICES: AppConfig["tts"]["voices"] = {
  fr: {
    default: FEMALE,
    sophie: FEMALE,
    barista: ["Aurélie (Enhanced)", "Amélie (Enhanced)", "Amélie"],
    baker: ["Thomas (Premium)", "Thomas (Enhanced)", "Thomas"],
    neighbor: ["Jacques (Premium)", "Jacques (Enhanced)", "Jacques"]
  }
};

/**
 * Who may call the API from a web view: the development page, and the installed
 * app, whose pages are served from these fixed local origins on iOS and Android.
 */
const DEFAULT_ORIGINS = "http://localhost:5173,capacitor://localhost,https://localhost,http://localhost";

export const APP_CONFIG = Symbol("APP_CONFIG");

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const cacheDir = env.TTS_CACHE_DIR ?? ".tts-cache";
  let voices = DEFAULT_VOICES;
  if (env.TTS_VOICES) {
    try {
      voices = JSON.parse(env.TTS_VOICES);
    } catch {
      throw new Error("TTS_VOICES must be valid JSON");
    }
  }
  return {
    port: Number(env.PORT ?? 3000),
    corsOrigins: (env.CORS_ORIGINS ?? DEFAULT_ORIGINS).split(",").map((origin) => origin.trim()).filter(Boolean),
    speech: {
      languages: (env.SPEECH_LANGUAGES ?? "fr").split(",").map((code) => code.trim()).filter(Boolean),
      serviceUrl: (env.SPEECH_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "")
    },
    ai: {
      provider: env.AI_PROVIDER ?? (env.OPENROUTER_API_KEY ? "openrouter" : "none"),
      model: env.AI_MODEL ?? "google/gemini-3.1-flash-lite",
      apiKey: env.OPENROUTER_API_KEY || undefined,
      baseUrl: (env.AI_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
      timeoutMs: Number(env.AI_TIMEOUT_MS ?? 8000),
      requestsPerMinute: Number(env.AI_REQUESTS_PER_MINUTE ?? 60)
    },
    tts: {
      provider: env.TTS_PROVIDER ?? "system",
      cacheDir: cacheDir === "off" ? undefined : resolve(cacheDir),
      voices
    }
  };
}
