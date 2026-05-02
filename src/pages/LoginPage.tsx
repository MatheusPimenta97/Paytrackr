import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LOGIN_PRIMARY = "#001430";
const LOGIN_SURFACE_BRIGHT = "#f7f9fb";
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

  const inputClass =
    "h-11 w-full rounded-lg border py-2 pl-11 pr-3 font-body text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#cee6f3] sm:h-12 sm:py-2.5 sm:text-[15px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600 lg:h-11 lg:text-sm";

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#050a14] via-[#0d2340] to-[#5a6d7e] font-body text-[#191c1e] lg:bg-[#f7f9fb] dark:text-slate-100 lg:dark:bg-slate-950">
      <main
        className={`relative z-10 flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-2 lg:gap-0 transition-all duration-700 ease-out ${
          exiting ? "login-page-exit-bg" : ""
        }`}
      >
        {/* Desktop: coluna ESQUERDA — espelha referência (gradiente vertical + copy) */}
        <section className="relative hidden h-full min-h-0 flex-col justify-between overflow-y-auto bg-gradient-to-b from-[#050a14] via-[#0d2340] to-[#5a6d7e] px-10 py-10 text-left text-white xl:px-14 xl:py-12 lg:flex">
          <div className="max-w-xl">
            <p className="font-headline text-lg font-bold tracking-tight text-white xl:text-xl">PayTrackr</p>

            <h2 className="mt-14 font-headline leading-[1.12] tracking-tight text-white xl:mt-16">
              <span className="block text-[1.65rem] font-semibold xl:text-[1.85rem]">Bem-vindo ao</span>
              <span className="mt-1 block text-[2.15rem] font-extrabold xl:text-[2.65rem]">PayTrackr</span>
            </h2>

            <p className="mt-8 max-w-[26rem] text-[15px] font-normal leading-[1.65] text-white/88 xl:mt-10 xl:max-w-lg xl:text-base xl:leading-relaxed">
              A plataforma definitiva para gestão financeira corporativa. Acompanhe fluxos de caixa, gerencie ativos e
              proteja seu patrimônio com segurança de nível bancário.
            </p>
          </div>

          <div className="mt-12 flex items-start gap-4 xl:mt-14">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-sky-200/45 bg-white/[0.06]">
              <span className="material-symbols-outlined filled text-[26px] text-white">shield</span>
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="font-headline text-[15px] font-bold tracking-tight text-white xl:text-base">
                Criptografia de Ponta
              </p>
              <p className="mt-2 max-w-sm text-[13px] leading-snug text-white/72 xl:text-sm xl:leading-relaxed">
                Seus dados financeiros são protegidos pelos protocolos mais avançados do mercado.
              </p>
            </div>
          </div>
        </section>

        {/* Mobile: mesmo degradê do desktop (via página); lg: coluna clara + card */}
        <div
          className={`flex flex-1 flex-col justify-center px-4 py-5 sm:px-6 lg:bg-[#f7f9fb] lg:px-8 lg:py-6 xl:px-10 ${
            exiting ? "login-page-exit-card" : "login-page-enter"
          }`}
        >
          <div className="mx-auto w-full max-w-[400px] lg:my-auto">
            {/* Mobile: ícone + título */}
            <div className="mb-5 w-full text-center lg:hidden">
              <div className="mb-3 inline-flex items-center justify-center rounded-xl border border-sky-200/35 bg-white/10 p-1.5 backdrop-blur-[2px]">
                <span className="material-symbols-outlined text-[28px] text-white">account_balance_wallet</span>
              </div>
              <h1 className="font-headline text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[28px]">
                PayTrackr
              </h1>
              <p className="mt-0.5 text-sm text-blue-100/85">Acesse sua conta com segurança</p>
            </div>

            <div
              className="w-full rounded-xl border bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.08)] sm:p-5 dark:border-slate-700 dark:bg-slate-900"
              style={{ borderColor: `${LOGIN_OUTLINE_VARIANT}4d` }}
            >
              <div className="mb-4 hidden lg:block">
                <h2 className="font-headline text-xl font-bold text-[#191c1e] dark:text-slate-100">Acesse sua conta</h2>
                <p className="mt-1 text-sm" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
                  Insira suas credenciais para gerenciar suas finanças.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1.5">
                  <label
                    className="block text-[10px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: LOGIN_ON_SURFACE_VARIANT }}
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <div className="group relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 transition-colors group-focus-within:text-[#001430]"
                      style={{ color: LOGIN_OUTLINE }}
                    >
                      <span className="material-symbols-outlined text-lg">mail</span>
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
                      className={inputClass}
                      style={{
                        backgroundColor: LOGIN_SURFACE_BRIGHT,
                        borderColor: LOGIN_OUTLINE_VARIANT,
                        color: LOGIN_ON_SURFACE,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="block text-[10px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: LOGIN_ON_SURFACE_VARIANT }}
                    htmlFor="password"
                  >
                    Senha
                  </label>
                  <div className="group relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 transition-colors group-focus-within:text-[#001430]"
                      style={{ color: LOGIN_OUTLINE }}
                    >
                      <span className="material-symbols-outlined text-lg">lock</span>
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
                      className={`${inputClass} pr-11`}
                      style={{
                        backgroundColor: LOGIN_SURFACE_BRIGHT,
                        borderColor: LOGIN_OUTLINE_VARIANT,
                        color: LOGIN_ON_SURFACE,
                      }}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 transition-colors hover:opacity-80"
                      style={{ color: LOGIN_OUTLINE }}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg bg-error-container px-2.5 py-1.5 text-xs font-medium text-on-error-container dark:bg-red-950/40 dark:text-red-200">
                    {error}
                  </p>
                )}

                <div className="flex w-full flex-row items-center justify-between gap-3 pt-0.5">
                  <label className="flex min-w-0 cursor-pointer items-center gap-2">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 shrink-0 rounded border text-primary focus:ring-2 focus:ring-offset-0 dark:border-slate-500 dark:bg-slate-800"
                      style={{ borderColor: LOGIN_OUTLINE_VARIANT }}
                    />
                    <span className="truncate text-xs sm:text-sm" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
                      Lembrar de mim
                    </span>
                  </label>
                  <span
                    className="shrink-0 cursor-not-allowed text-right text-xs font-semibold opacity-70 sm:text-sm"
                    style={{ color: LOGIN_PRIMARY }}
                  >
                    Esqueci minha senha
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={exiting}
                  className="h-11 w-full rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80 sm:h-12 sm:text-[15px] dark:bg-slate-700"
                  style={{ backgroundColor: LOGIN_PRIMARY }}
                >
                  {exiting ? "Entrando…" : "Entrar"}
                </button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" style={{ borderColor: LOGIN_OUTLINE_VARIANT }} />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="bg-white px-2 text-[10px] font-semibold uppercase tracking-wide dark:bg-slate-900 sm:text-xs"
                    style={{ color: LOGIN_OUTLINE }}
                  >
                    Ou acesse com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled
                  title="Disponível em breve"
                  className="flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border opacity-70 dark:border-slate-600 sm:h-11"
                  style={{ borderColor: LOGIN_OUTLINE_VARIANT, backgroundColor: LOGIN_SURFACE_BRIGHT }}
                >
                  <img src={GOOGLE_ICON_SRC} alt="" className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" loading="lazy" />
                  <span className="text-xs font-medium dark:text-slate-300 sm:text-sm">Google</span>
                </button>
                <button
                  type="button"
                  disabled
                  title="Disponível em breve"
                  className="flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border opacity-70 dark:border-slate-600 sm:h-11"
                  style={{ borderColor: LOGIN_OUTLINE_VARIANT, backgroundColor: LOGIN_SURFACE_BRIGHT }}
                >
                  <span className="material-symbols-outlined text-lg dark:text-slate-300 sm:text-xl">ios</span>
                  <span className="text-xs font-medium dark:text-slate-300 sm:text-sm">Apple</span>
                </button>
              </div>

              <p className="mt-4 text-center text-xs sm:text-sm" style={{ color: LOGIN_ON_SURFACE_VARIANT }}>
                Não tem uma conta?{" "}
                <span className="ml-1 cursor-not-allowed font-bold opacity-60" style={{ color: LOGIN_PRIMARY }}>
                  Cadastre-se
                </span>
              </p>
            </div>

            <p className="mt-4 hidden text-center text-[10px] leading-snug text-slate-500 lg:block dark:text-slate-400">
              Ao entrar, você concorda com nossos{" "}
              <Link to="/login" className="font-semibold text-primary underline-offset-2 hover:underline dark:text-slate-300">
                Termos de Uso
              </Link>{" "}
              e{" "}
              <Link to="/login" className="font-semibold text-primary underline-offset-2 hover:underline dark:text-slate-300">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center sm:items-start">
            <span className="font-headline text-sm font-bold text-blue-900 dark:text-slate-200">PayTrackr</span>
            <p className="mt-0.5 text-center font-body text-[10px] text-slate-500 dark:text-slate-400 sm:text-left sm:text-[11px]">
              © {new Date().getFullYear()} PayTrackr. Todos os direitos reservados.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 sm:justify-end">
            <Link to="/login" className="text-[10px] text-slate-500 hover:text-blue-900 dark:hover:text-slate-300 sm:text-xs">
              Privacidade
            </Link>
            <Link to="/login" className="text-[10px] text-slate-500 hover:text-blue-900 dark:hover:text-slate-300 sm:text-xs">
              Termos de uso
            </Link>
            <Link to="/login" className="text-[10px] text-slate-500 hover:text-blue-900 dark:hover:text-slate-300 sm:text-xs">
              Cookies
            </Link>
            <Link to="/login" className="text-[10px] text-slate-500 hover:text-blue-900 dark:hover:text-slate-300 sm:text-xs">
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
