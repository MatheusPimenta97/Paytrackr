import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { isAuthenticated, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    document.title = "Login | PayTrackr Sovereign Ledger";
    return () => {
      document.title = "PayTrackr | Dashboard Principal";
    };
  }, []);

  if (ready && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ok = login(email, password, remember);
    if (!ok) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    setExiting(true);
    window.setTimeout(() => navigate("/", { replace: true }), 720);
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background font-body text-on-background dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-surface-container opacity-40 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[30%] w-[30%] rounded-full bg-primary-fixed opacity-30 blur-[100px]" />
      </div>

      <main
        className={`relative z-10 flex flex-grow items-center justify-center px-6 py-12 transition-all duration-700 ease-out ${
          exiting ? "login-page-exit-bg" : ""
        }`}
      >
        <div className={`w-full max-w-md ${exiting ? "login-page-exit-card" : "login-page-enter"}`}>
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-light md:p-10">
            <div className="mb-10 flex flex-col items-center">
              <div className="mb-2 font-headline text-3xl font-extrabold tracking-tight text-primary">
                PayTrackr
              </div>
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-primary to-primary-container" />
            </div>

            <div className="mb-8 text-center">
              <h1 className="mb-2 font-headline text-2xl font-bold text-on-surface">Acesse sua conta</h1>
              <p className="font-body text-sm tracking-wide text-on-surface-variant">
                Bem-vindo de volta ao The Sovereign Ledger
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label
                  className="ml-1 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                  htmlFor="email"
                >
                  Email
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-outline transition-colors group-focus-within:text-primary">
                    <span className="material-symbols-outlined text-[20px]">mail</span>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@paytrackr.com"
                    className="block w-full rounded-lg border-none bg-surface-container-high py-3.5 pl-11 pr-4 font-body text-sm text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-[0_0_0_1px_#001d44] focus:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="ml-1 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                  htmlFor="password"
                >
                  Senha
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-outline transition-colors group-focus-within:text-primary">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border-none bg-surface-container-high py-3.5 pl-11 pr-12 font-body text-sm text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-[0_0_0_1px_#001d44] focus:ring-0"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-outline transition-colors hover:text-on-surface"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-error-container px-3 py-2 text-sm font-medium text-on-error-container">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-outline-variant bg-surface-container-high text-primary focus:ring-primary/20"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-on-surface-variant">
                    Lembrar de mim
                  </label>
                </div>
                <span className="text-sm">
                  <span className="cursor-not-allowed font-semibold text-primary/50">Esqueci minha senha</span>
                </span>
              </div>

              <button
                type="submit"
                disabled={exiting}
                className="w-full rounded-lg bg-gradient-to-r from-primary to-primary-container py-4 px-6 font-headline font-bold text-on-primary shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80"
              >
                {exiting ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <div className="mt-8 border-t border-outline-variant/15 pt-8 text-center">
              <p className="text-sm font-medium text-on-surface-variant">
                Não tem uma conta?{" "}
                <span className="ml-1 cursor-not-allowed font-bold text-primary/50">Cadastre-se</span>
              </p>
            </div>
          </div>

          <div className="mt-12 hidden text-center md:block">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-xs font-semibold tracking-wide text-on-primary-fixed-variant">
              <span className="material-symbols-outlined filled text-[14px] text-on-primary-fixed-variant">
                verified_user
              </span>
              The Sovereign Ledger Protocol Active
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mt-auto w-full border-t border-outline-variant/10 bg-slate-50 py-8 px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex flex-col items-center md:items-start">
            <span className="mb-1 font-headline font-bold text-primary">PayTrackr</span>
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant/60">
              © 2026 PayTrackr Sovereign Ledger. All rights reserved.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-8">
            <Link to="/" className="font-label text-xs tracking-wide text-on-surface-variant transition-all duration-200 hover:text-primary">
              Privacy Policy
            </Link>
            <Link to="/" className="font-label text-xs tracking-wide text-on-surface-variant transition-all duration-200 hover:text-primary">
              Terms of Service
            </Link>
            <Link to="/" className="font-label text-xs tracking-wide text-on-surface-variant transition-all duration-200 hover:text-primary">
              Security
            </Link>
            <Link to="/" className="font-label text-xs tracking-wide text-on-surface-variant transition-all duration-200 hover:text-primary">
              Help Center
            </Link>
          </nav>
        </div>
      </footer>

      <div className="pointer-events-none fixed bottom-0 left-0 z-20 h-[2px] w-full bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0" />

      {exiting && (
        <div
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-primary/10 backdrop-blur-[2px]"
          aria-hidden
        >
          <div className="login-success-burst flex h-24 w-24 items-center justify-center rounded-full bg-secondary text-on-secondary shadow-lg">
            <span className="material-symbols-outlined filled text-5xl">check_circle</span>
          </div>
        </div>
      )}
    </div>
  );
}
