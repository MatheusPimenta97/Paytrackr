import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getFirebaseAuth, getGoogleAuthProvider } from "../firebase/init";

const STORAGE_KEY = "paytrackr-auth-v1";

/** Credenciais de demonstração quando Firebase não está configurado. */
export const DEMO_EMAIL = "demo@paytrackr.com";
export const DEMO_PASSWORD = "paytrackr";

export type AuthMode = "demo" | "firebase";

/** Dados públicos do usuário Firebase (para perfil / armazenamento por conta). */
export type FirebasePublicProfile = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

type AuthContextValue = {
  mode: AuthMode;
  isAuthenticated: boolean;
  ready: boolean;
  /** E-mail da sessão Firebase; demo não preenche. */
  userEmail: string | null;
  firebaseProfile: FirebasePublicProfile | null;
  login: (email: string, password: string, remember: boolean) => Promise<boolean>;
  loginWithGoogle: (remember: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredDemoSession(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return true;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>("demo");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<FirebasePublicProfile | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setMode("demo");
      setUserEmail(null);
      setFirebaseProfile(null);
      setIsAuthenticated(readStoredDemoSession());
      setReady(true);
      return;
    }

    setMode("firebase");
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email ?? null);
      setFirebaseProfile(
        user
          ? {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
            }
          : null,
      );
      setIsAuthenticated(!!user);
      setReady(true);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const auth = getFirebaseAuth();
    if (auth) {
      try {
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email.trim(), password);
        return true;
      } catch {
        return false;
      }
    }

    const ok =
      email.trim().toLowerCase() === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD;
    if (!ok) return false;
    try {
      if (remember) {
        localStorage.setItem(STORAGE_KEY, "1");
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, "1");
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* still allow session in memory */
    }
    setIsAuthenticated(true);
    return true;
  }, []);

  const loginWithGoogle = useCallback(async (remember: boolean) => {
    const auth = getFirebaseAuth();
    if (!auth) return false;
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithPopup(auth, getGoogleAuthProvider());
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      try {
        await signOut(auth);
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsAuthenticated(false);
    setUserEmail(null);
    setFirebaseProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isAuthenticated,
      ready,
      userEmail,
      firebaseProfile,
      login,
      loginWithGoogle,
      logout,
    }),
    [mode, isAuthenticated, ready, userEmail, firebaseProfile, login, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
