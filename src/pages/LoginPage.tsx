import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from "../context/AuthContext";

const LOGIN_PRIMARY = "#001430";
const LOGIN_SURFACE_BRIGHT = "#f7f9fb";
const LOGIN_SECONDARY_CONTAINER = "#cee6f3";
const LOGIN_PRIMARY_FIXED_DIM = "#aac7fd";
const LOGIN_OUTLINE_VARIANT = "#c4c6d0";
const LOGIN_ON_SURFACE = "#191c1e";
const LOGIN_ON_SURFACE_VARIANT = "#43474f";
const LOGIN_OUTLINE = "#747780";

const GOOGLE_ICON_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAhHnY6C6oTvENiwIz-tCiWqfwoAq1p-7Z2hfjr_GiHrNVTSCTkGct3R27LaXwZc1uPHEZbRctwkRxEXcZSuU5yiyMvTHWH2Gku6wlY6iYNlsafZKSC6fU9Zs7wmSvYSJcyMlFD_DLvifvlS2vOa611RmrX3uFxN7zgVY4zwEe-zD0iIFN7TUzsuIvL5KyrtTgaa82cFNY0eHnB3ozFywXhcUUrRu0bp8NIViAxcyrE3Pwj5jQtGnxLanxRmlMAzFptl8pZ8fyXbDDR";

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
    document.title = "Login | PayTrackr";
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
    <div className="relative flex min-h-[100dvh] flex-col bg-[#f7f9fb] font-body text-[#191c1e] dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40">
        <div
          className="absolute -right-[10%] -top-[10%] h-[500px] w-[500px] rounded-full blur-[100px]"
          style={{ backgroundColor: LOGIN_SECONDARY_CONTAINER }}
        />
        <div
          className="absolute -bottom-[10%] -left-[10%] h-[400px] w-[400px] rounded-full blur-[100px]"
          style={{ backgroundColor: LOGIN_PRIMARY_FIXED_DIM }}
        />
      </div>

      <main
        className={`relative z-10 flex flex-grow flex-col justify-center px-4 py-10 sm:px-6 lg:py-14 transition-all duration-700 ease-out ${
          exiting ? "login-page-exit-bg" : ""
        }`}
      >
        <div
          className={`mx-auto grid w-full max-w-md gap-10 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] lg:items-center lg:gap-16 xl:gap-24 ${
            exiting ? "login-page-exit-card" : "login-page-enter"
          }`}
        >
          {/* Desktop: coluna institucional */}
          <section className="hidden lg:flex lg:flex-col lg:justify-center lg:pr-8">
            <div
              className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: LOGIN_SECONDARY_CONTAINER }}
            >
              <span className="material-symbols-outlined text-4xl" style={{ color: LOGIN_PRIMARY }}>
                account_balance_wallet
              </span>
            </div>
            <h2 className="font-headline text-4xl font-bold tracking-tight xl:text-5xl" style={{ color: LOGIN_PRIMARY }}>
              Suas finanças, um só lugar.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
              No desktop você ganha mais espaço para revisar saldos, cartões e metas com calma — o mesmo login seguro do
              celular.
            </p>
            <ul className="mt-8 space-y-4 text-sm font-medium" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-xl text-emerald-700">check_circle</span>
                Dados ficam neste navegador até você configurar nuvem.
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-xl text-emerald-700">check_circle</span>
                Ideal para uso diário em tela grande ou notebook.
              </li>
            </ul>
          </section>

          <div className="flex w-full flex-col items-center lg:items-stretch">
            {/* Mobile: ícone + título acima do card */}
            <div className="mb-8 w-full text-center lg:hidden">
              <div className="mb-4 inline-flex items-center justify-center rounded-xl p-2" style={{ backgroundColor: LOGIN_SECONDARY_CONTAINER }}>
                <span className="material-symbols-outlined text-3xl" style={{ color: LOGIN_PRIMARY }}>
                  account_balance_wallet
                </span>
              </div>
              <h1 className="font-headline text-[32px] font-bold leading-tight tracking-tight" style={{ color: LOGIN_PRIMARY }}>
                PayTrackr
              </h1>
              <p className="mt-1 text-base" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
                Acesse sua conta com segurança
              </p>
            </div>

            {/* Desktop: título compacto dentro da área do formulário */}
            <div className="mb-8 hidden text-center lg:block lg:text-left">
              <h1 className="font-headline text-[32px] font-bold leading-tight tracking-tight" style={{ color: LOGIN_PRIMARY }}>
                PayTrackr
              </h1>
              <p className="mt-1 text-base" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
                Acesse sua conta com segurança
              </p>
            </div>

            <div
              className="w-full rounded-xl border bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] sm:p-8 dark:border-slate-700 dark:bg-slate-900"
              style={{ borderColor: `${LOGIN_OUTLINE_VARIANT}4d` }}
            >
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="space-y-2">
                  <label
                    className="block text-xs font-semibold uppercase tracking-[0.05em]"
                    style={{ color: LOGIN_ON_SURFACE_VARIANT }}
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <div className="group relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors group-focus-within:text-[#001430]"
                      style={{ color: LOGIN_OUTLINE }}
                    >
                      <span className="material-symbols-outlined text-xl">mail</span>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="h-14 w-full rounded-lg border py-3 pl-12 pr-4 font-body text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#cee6f3] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                      style={
                        {
                          backgroundColor: LOGIN_SURFACE_BRIGHT,
                          borderColor: LOGIN_OUTLINE_VARIANT,
                          color: LOGIN_ON_SURFACE,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-xs font-semibold uppercase tracking-[0.05em]"
                    style={{ color: LOGIN_ON_SURFACE_VARIANT }}
                    htmlFor="password"
                  >
                    Senha
                  </label>
                  <div className="group relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors group-focus-within:text-[#001430]"
                      style={{ color: LOGIN_OUTLINE }}
                    >
                      <span className="material-symbols-outlined text-xl">lock</span>
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
                      className="h-14 w-full rounded-lg border py-3 pl-12 pr-12 font-body text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#cee6f3] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                      style={
                        {
                          backgroundColor: LOGIN_SURFACE_BRIGHT,
                          borderColor: LOGIN_OUTLINE_VARIANT,
                          color: LOGIN_ON_SURFACE,
                        } as React.CSSProperties
                      }
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 transition-colors hover:opacity-80"
                      style={{ color: LOGIN_OUTLINE }}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg bg-error-container px-3 py-2 text-sm font-medium text-on-error-container dark:bg-red-950/40 dark:text-red-200">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-5 w-5 rounded border text-primary focus:ring-2 focus:ring-offset-0 dark:border-slate-500 dark:bg-slate-800"
                      style={{ borderColor: LOGIN_OUTLINE_VARIANT }}
                    />
                    <span className="text-sm" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
                      Lembrar de mim
                    </span>
                  </label>
                  <span
                    className="cursor-not-allowed text-center text-sm font-semibold opacity-60 sm:text-right"
                    style={{ color: LOGIN_PRIMARY }}
                  >
                    Esqueci minha senha
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={exiting}
                  className="h-14 w-full rounded-lg font-semibold text-[15px] text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80 dark:bg-slate-700"
                  style={{ backgroundColor: LOGIN_PRIMARY }}
                >
                  {exiting ? "Entrando…" : "Entrar"}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" style={{ borderColor: LOGIN_OUTLINE_VARIANT }} />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="bg-white px-3 text-xs font-semibold uppercase tracking-wide dark:bg-slate-900"
                    style={{ color: LOGIN_OUTLINE }}
                  >
                    Ou acesse com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  disabled
                  title="Disponível em breve"
                  className="flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-lg border opacity-70 dark:border-slate-600"
                  style={{ borderColor: LOGIN_OUTLINE_VARIANT, backgroundColor: LOGIN_SURFACE_BRIGHT }}
                >
                  <img src={GOOGLE_ICON_SRC} alt="" className="h-5 w-5 shrink-0" loading="lazy" />
                  <span className="text-sm font-medium dark:text-slate-300">Google</span>
                </button>
                <button
                  type="button"
                  disabled
                  title="Disponível em breve"
                  className="flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-lg border opacity-70 dark:border-slate-600"
                  style={{ borderColor: LOGIN_OUTLINE_VARIANT, backgroundColor: LOGIN_SURFACE_BRIGHT }}
                >
                  <span className="material-symbols-outlined text-xl dark:text-slate-300">ios</span>
                  <span className="text-sm font-medium dark:text-slate-300">Apple</span>
                </button>
              </div>

              <p className="mt-8 text-center text-sm" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
                Não tem uma conta?{" "}
                <span className="ml-1 cursor-not-allowed font-bold opacity-60" style={{ color: LOGIN_PRIMARY }}>
                  Cadastre-se
                </span>
              </p>

              <p className="mt-6 rounded-lg border border-dashed px-3 py-2 text-center text-xs dark:border-slate-600 dark:text-slate-400" style={{ borderColor: LOGIN_OUTLINE_VARIANT, color: LOGIN_ON_SURFACE_VARIANT }}>
                Demonstração: use <strong className="font-semibold text-[#001430] dark:text-slate-200">{DEMO_EMAIL}</strong> e senha{" "}
                <strong>{DEMO_PASSWORD}</strong>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mt-auto w-full border-t border-slate-200 bg-slate-50 py-8 px-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center md:items-start">
            <span className="font-headline font-bold text-blue-900 dark:text-slate-200">PayTrackr</span>
            <p className="mt-1 text-center font-body text-xs text-slate-500 dark:text-slate-400 md:text-left">
              © {new Date().getFullYear()} PayTrackr. Todos os direitos reservados.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 md:justify-end">
            <Link to="/login" className="text-xs text-slate-500 hover:text-blue-900 dark:hover:text-slate-300">
              Privacidade
            </Link>
            <Link to="/login" className="text-xs text-slate-500 hover:text-blue-900 dark:hover:text-slate-300">
              Termos de uso
            </Link>
            <Link to="/login" className="text-xs text-slate-500 hover:text-blue-900 dark:hover:text-slate-300">
              Cookies
            </Link>
            <Link to="/login" className="text-xs text-slate-500 hover:text-blue-900 dark:hover:text-slate-300">
              Contato
            </Link>
          </nav>
        </div>
      </footer>

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
