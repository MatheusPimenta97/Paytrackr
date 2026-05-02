import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

const DISMISS_KEY = "paytrackr-banner-data-scope-v1";

export function DataScopeBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div
      role="status"
      className="border-b border-amber-200/80 bg-gradient-to-r from-amber-50 to-amber-100/90 px-4 py-3 text-amber-950 shadow-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-12">
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <p className="font-headline font-bold text-primary">Outro aparelho não vê seus lançamentos automaticamente</p>
          <p className="mt-1 text-on-surface-variant">
            Fora do modo dev, os dados ficam{" "}
            <strong className="text-on-surface">só neste navegador</strong> — a conta não sincroniza na nuvem. Com{" "}
            <strong className="text-on-surface">npm run dev</strong>, o app tenta espelhar os dados no PC que está
            rodando o Vite (até ~4s de atraso no outro aparelho). Em build de produção use backup em Configurações.
          </p>
          <p className="mt-2 font-mono text-xs text-on-surface-variant">
            Endereço desta cópia dos dados: <span className="font-semibold text-primary">{origin}</span>
            {" · "}
            <span className="font-sans text-[11px] font-normal">
              (se no PC você usa <code className="rounded bg-white/60 px-1">localhost</code> e no celular o{" "}
              <code className="rounded bg-white/60 px-1">IP</code>, são armazenamentos separados até no mesmo Wi‑Fi)
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to="/settings#sync-outros"
            className="rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-on-primary shadow-sm hover:brightness-110"
          >
            Fazer backup
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-outline-variant/40 bg-white/80 px-3 py-2 text-xs font-bold text-primary hover:bg-white"
          >
            Entendi, ocultar
          </button>
        </div>
      </div>
    </div>
  );
}
