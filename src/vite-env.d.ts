/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** POST JSON { intent: "payment_receipt", imageBase64, mimeType, locale } — ver src/services/aiAssistant.ts */
  readonly VITE_AI_ASSISTANT_URL?: string;

  /** Firebase Web App — preenchidos → Auth real + Firestore disponível em src/firebase/init.ts */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
