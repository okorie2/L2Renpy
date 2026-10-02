/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the application backend. Without it the game runs silently. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
