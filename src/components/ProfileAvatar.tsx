import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";

type Props = {
  className?: string;
};

/** Avatar circular (referência: borda menta, fundo escuro, atalhos para perfil e sair). */
export function ProfileAvatar({ className = "" }: Props) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { state } = useFinance();
  const photo = state.profile.photoDataUrl;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function goProfile() {
    setOpen(false);
    navigate("/perfil");
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Perfil e sessão"
        className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-full border-2 border-[#5eead4] bg-gradient-to-b from-zinc-600 to-zinc-950 text-white shadow-md outline-none ring-[#5eead4]/35 transition-all hover:ring-2 focus-visible:ring-2 dark:border-teal-300 dark:from-zinc-700 dark:to-black"
      >
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <span className="material-symbols-outlined text-[22px] leading-none text-white">person</span>
            <span className="mt-0.5 max-w-[48px] px-0.5 text-center text-[5.5px] font-bold uppercase leading-tight tracking-wide text-white/95">
              Meu perfil
            </span>
            <span className="max-w-[48px] px-0.5 text-center text-[4.5px] font-semibold uppercase leading-tight tracking-wider text-white/55">
              Sair agora
            </span>
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[100] mt-2 min-w-[11rem] rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-1 shadow-light"
        >
          <button
            type="button"
            role="menuitem"
            onClick={goProfile}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-primary transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[20px]">badge</span>
            Meu perfil
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-error transition-colors hover:bg-error-container/40"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sair agora
          </button>
        </div>
      )}
    </div>
  );
}
