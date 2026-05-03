import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/** Configuração do app web (Console → Configurações do projeto → Seus apps). */
export function readFirebaseWebConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
  };
}

let app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp | null {
  const cfg = readFirebaseWebConfig();
  if (!cfg) return null;
  if (!app) app = initializeApp(cfg);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  return a ? getAuth(a) : null;
}

/** Firestore já fica disponível para sincronização de dados no próximo passo. */
export function getFirestoreDb(): Firestore | null {
  const a = getFirebaseApp();
  return a ? getFirestore(a) : null;
}

let googleProvider: GoogleAuthProvider | undefined;

export function getGoogleAuthProvider(): GoogleAuthProvider {
  if (!googleProvider) googleProvider = new GoogleAuthProvider();
  return googleProvider;
}
