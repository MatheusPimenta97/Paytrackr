import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "paytrackr-auth-v1";

/** Credenciais de demonstração (ambiente local). */
export const DEMO_EMAIL = "demo@paytrackr.com";
export const DEMO_PASSWORD = "paytrackr";

type AuthContextValue = {
  isAuthenticated: boolean;
  ready: boolean;
  login: (email: string, password: string, remember: boolean) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): boolean {
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(readStoredSession());
    setReady(true);
  }, []);

  const login = useCallback((email: string, password: string, remember: boolean) => {
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

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, ready, login, logout }),
    [isAuthenticated, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
