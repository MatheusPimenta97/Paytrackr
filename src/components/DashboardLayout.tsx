import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [calcOpen, setCalcOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased dark:bg-slate-950 dark:text-slate-100">
      <QuickCalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} />
      <nav className="fixed top-0 z-50 h-20 w-full bg-[#f3faff]/80 shadow-light backdrop-blur-md dark:bg-[#001d44]/80 dark:shadow-none">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6 md:px-12">
          <div className="flex items-center gap-6 lg:gap-8">
            <NavLink
              to="/"
              className="font-headline text-2xl font-black tracking-tighter text-[#001d44] dark:text-[#f3faff]"
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
          <div className="flex items-center space-x-4 md:space-x-6">
            <button
              type="button"
              className="scale-95 text-[#43474f] transition-colors duration-200 ease-in-out hover:text-[#001d44]"
              aria-label="Notificações"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <NavLink
              to="/settings"
              className="scale-95 text-[#43474f] transition-colors duration-200 ease-in-out hover:text-[#001d44]"
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

      <nav className="fixed bottom-0 z-50 flex h-16 w-full items-center justify-start gap-1 overflow-x-auto bg-[#f3faff]/80 px-2 shadow-ambient-up backdrop-blur-md md:hidden [&::-webkit-scrollbar]:hidden">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex min-w-[3.25rem] shrink-0 flex-col items-center ${isActive ? "text-[#1b6d24]" : "text-slate-500"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>home</span>
              <span className="text-[10px] font-bold">Home</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/lancamentos"
          className={({ isActive }) =>
            `flex min-w-[3.25rem] shrink-0 flex-col items-center ${isActive ? "text-[#1b6d24]" : "text-slate-500"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>
                receipt_long
              </span>
              <span className="max-w-[4.5rem] text-center text-[10px] font-bold leading-tight">
                Lançamentos
              </span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/valores-a-receber"
          className={({ isActive }) =>
            `flex min-w-[3.25rem] shrink-0 flex-col items-center ${isActive ? "text-[#1b6d24]" : "text-slate-500"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>
                account_balance_wallet
              </span>
              <span className="max-w-[4rem] text-center text-[10px] font-bold leading-tight">
                A receber
              </span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          onClick={() => navigate("/lancamentos?novo=1")}
          className="-mt-8 flex h-12 w-12 shrink-0 items-center justify-center rounded-[9999px] bg-primary text-white shadow-lg"
          aria-label="Adicionar"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
        <NavLink
          to="/pontos"
          className={({ isActive }) =>
            `flex min-w-[3.25rem] shrink-0 flex-col items-center ${isActive ? "text-[#1b6d24]" : "text-slate-500"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>stars</span>
              <span className="text-[10px] font-bold">Pontos</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/metas"
          className={({ isActive }) =>
            `flex min-w-[3.25rem] shrink-0 flex-col items-center ${isActive ? "text-[#1b6d24]" : "text-slate-500"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>
                pie_chart
              </span>
              <span className="text-[10px] font-bold">Metas</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            `flex min-w-[3.25rem] shrink-0 flex-col items-center ${isActive ? "text-[#1b6d24]" : "text-slate-500"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>person</span>
              <span className="text-[10px] font-bold">Perfil</span>
            </>
          )}
        </NavLink>
      </nav>

      <div className="fixed bottom-32 right-6 z-40 md:bottom-6">
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl ring-2 ring-primary/20 transition-transform hover:scale-105 hover:bg-primary-container active:scale-95 dark:ring-white/10"
          aria-label="Calculadora rápida"
        >
          <span className="material-symbols-outlined text-[28px]">calculate</span>
        </button>
      </div>

      <div className="fixed bottom-20 right-6 z-40 md:hidden">
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
