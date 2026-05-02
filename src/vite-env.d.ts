/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** POST JSON { intent: "payment_receipt", imageBase64, mimeType, locale } — ver src/services/aiAssistant.ts */
  readonly VITE_AI_ASSISTANT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
