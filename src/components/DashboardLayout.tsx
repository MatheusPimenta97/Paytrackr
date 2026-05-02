import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { DataScopeBanner } from "./DataScopeBanner";
import { ProfileAvatar } from "./ProfileAvatar";
import { QuickCalculatorModal } from "./QuickCalculatorModal";

const topNav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/gastos-recorrentes", label: "Gastos Recorrentes" },
  { to: "/lancamentos", label: "Lançamentos" },
  { to: "/valores-a-receber", label: "Valores a receber" },
  { to: "/pontos", label: "Pontos" },
  { to: "/metas", label: "Metas" },
];

export function DashboardLayout() {
  const [calcOpen, setCalcOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased dark:bg-slate-950 dark:text-slate-100">
      <QuickCalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} />
      <nav className="fixed top-0 z-50 h-20 w-full border-b border-slate-200 bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-950 md:border-transparent md:bg-[#f3faff]/80 md:shadow-light md:backdrop-blur-md md:dark:border-transparent md:dark:bg-[#001d44]/80 md:dark:shadow-none">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6 md:px-12">
          <div className="flex items-center gap-6 lg:gap-8">
            <NavLink
              to="/"
              className="font-headline text-2xl font-extrabold tracking-tight text-blue-900 dark:text-blue-100 md:font-black md:tracking-tighter md:text-[#001d44] md:dark:text-[#f3faff]"
            >
              PayTrackr
            </NavLink>
            <div className="hidden items-center space-x-8 font-manrope text-sm font-bold tracking-tight md:flex">
              {topNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "transition-colors",
                      isActive
                        ? "border-b-2 border-[#1b6d24] pb-1 font-extrabold text-[#1b6d24] dark:text-[#1b6d24]"
                        : "font-medium text-[#43474f] hover:text-[#001d44] dark:text-slate-400",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 md:space-x-6 md:gap-0">
            <button
              type="button"
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 md:scale-95 md:text-[#43474f] md:hover:bg-transparent md:hover:text-[#001d44]"
              aria-label="Notificações"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <NavLink
              to="/settings"
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 md:scale-95 md:text-[#43474f] md:hover:bg-transparent md:hover:text-[#001d44]"
              aria-label="Configurações"
            >
              <span className="material-symbols-outlined">settings</span>
            </NavLink>
            <ProfileAvatar />
          </div>
        </div>
      </nav>

      <main className="pb-24 pt-28 md:pb-0 dark:[&_.text-on-background]:text-slate-100 dark:[&_.text-on-surface-variant]:text-slate-400 dark:[&_.text-primary]:text-slate-100">
        <DataScopeBanner />
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-around border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 md:hidden">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? "text-[#001430] dark:text-blue-300" : "text-slate-400"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>dashboard</span>
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>Início</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/lancamentos"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? "text-[#001430] dark:text-blue-300" : "text-slate-400"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>account_balance_wallet</span>
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>Carteira</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/gastos-recorrentes"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? "text-[#001430] dark:text-blue-300" : "text-slate-400"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>analytics</span>
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>Análise</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? "text-[#001430] dark:text-blue-300" : "text-slate-400"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>person</span>
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>Perfil</span>
            </>
          )}
        </NavLink>
      </nav>

      <div className="fixed bottom-24 right-5 z-40 md:bottom-5 md:right-5">
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl ring-2 ring-primary/20 transition-transform hover:scale-105 hover:bg-primary-container active:scale-95 dark:ring-white/10 md:h-11 md:w-11 md:shadow-lg"
          aria-label="Calculadora rápida"
        >
          <span className="material-symbols-outlined text-[28px] md:text-[22px]">calculate</span>
        </button>
      </div>

      <div className="fixed bottom-[5.5rem] right-5 z-40 md:hidden">
        <button
          type="button"
          className="flex h-14 w-14 items-center justify-center rounded-[9999px] bg-gradient-to-br from-secondary to-on-secondary-container text-white shadow-2xl"
          aria-label="Escanear QR"
        >
          <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
        </button>
      </div>
    </div>
  );
}
