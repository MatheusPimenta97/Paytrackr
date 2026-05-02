import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { DataScopeBanner } from "./DataScopeBanner";
import { ProfileAvatar } from "./ProfileAvatar";
import { QuickCalculatorModal } from "./QuickCalculatorModal";
import { useFinance } from "../context/FinanceContext";

const sidebarNav = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/gastos-recorrentes", label: "Resumo mensal", icon: "schedule" },
  { to: "/lancamentos", label: "Transações", icon: "receipt_long" },
  { to: "/valores-a-receber", label: "Recebíveis", icon: "request_quote" },
  { to: "/pontos", label: "Pontos", icon: "stars" },
  { to: "/metas", label: "Metas", icon: "flag" },
] as const;

export function DashboardLayout() {
  const [calcOpen, setCalcOpen] = useState(false);
  const { state } = useFinance();
  const photo = state.profile.photoDataUrl;
  const displayName = state.profile.displayName.trim() || "Perfil";

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased dark:bg-slate-950 dark:text-slate-100">
      <QuickCalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} />

      {/* Sidebar desktop — 72px, expande no hover */}
      <aside className="group/dash-sidebar fixed left-0 top-0 z-[60] hidden h-screen w-[72px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-[#001430] to-[#002855] shadow-2xl transition-[width] duration-300 ease-in-out hover:w-[260px] md:flex">
        <div className="flex h-14 items-center overflow-hidden px-4">
          <span className="material-symbols-outlined shrink-0 text-2xl text-white">account_balance_wallet</span>
          <span className="ml-3 max-w-0 overflow-hidden whitespace-nowrap font-headline text-base font-semibold tracking-tight text-white opacity-0 transition-[max-width,opacity] duration-300 ease-in-out group-hover/dash-sidebar:max-w-[180px] group-hover/dash-sidebar:opacity-100">
            PayTrackr
          </span>
        </div>

        <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-hidden px-3">
          {sidebarNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex h-9 shrink-0 items-center rounded-lg px-2.5 transition-all duration-200",
                  isActive
                    ? "-ml-1 border-l-4 border-white bg-white/10 font-semibold text-white"
                    : "font-medium text-white/70 hover:bg-white/10 hover:text-white",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined shrink-0 text-xl ${isActive ? "filled" : ""}`}
                  >
                    {item.icon}
                  </span>
                  <span className="ml-4 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-300 ease-in-out group-hover/dash-sidebar:max-w-[200px] group-hover/dash-sidebar:opacity-100">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="overflow-hidden border-t border-white/10 p-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              [
                "flex h-9 items-center rounded-lg px-2.5 transition-all duration-200",
                isActive
                  ? "-ml-1 border-l-4 border-white bg-white/10 font-semibold text-white"
                  : "font-medium text-white/70 hover:bg-white/10 hover:text-white",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <span className={`material-symbols-outlined shrink-0 text-xl ${isActive ? "filled" : ""}`}>
                  settings
                </span>
                <span className="ml-4 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-300 ease-in-out group-hover/dash-sidebar:max-w-[200px] group-hover/dash-sidebar:opacity-100">
                  Configurações
                </span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/perfil"
            className="mt-2 flex items-center px-1.5 transition-opacity hover:opacity-95"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 ring-2 ring-white/30">
              {photo ? (
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-lg text-white">person</span>
              )}
            </div>
            <div className="ml-3 max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-300 ease-in-out group-hover/dash-sidebar:max-w-[200px] group-hover/dash-sidebar:opacity-100">
              <p className="text-xs font-bold text-white">{displayName}</p>
              <p className="text-[10px] font-medium text-white/60">Ver perfil</p>
            </div>
          </NavLink>
        </div>
      </aside>

      {/* Top bar — só mobile */}
      <nav className="fixed top-0 z-50 h-20 w-full border-b border-slate-200 bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-950 md:hidden">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">
          <NavLink
            to="/"
            className="font-headline text-2xl font-extrabold tracking-tight text-blue-900 dark:text-blue-100"
          >
            PayTrackr
          </NavLink>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Notificações"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <NavLink
              to="/settings"
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Configurações"
            >
              <span className="material-symbols-outlined">settings</span>
            </NavLink>
            <ProfileAvatar />
          </div>
        </div>
      </nav>

      <main className="pb-24 pt-28 md:ml-[72px] md:pb-8 md:pt-6 dark:[&_.text-on-background]:text-slate-100 dark:[&_.text-on-surface-variant]:text-slate-400 dark:[&_.text-primary]:text-slate-100">
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

      <div className="fixed bottom-24 right-5 z-40 md:bottom-8 md:right-8">
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
