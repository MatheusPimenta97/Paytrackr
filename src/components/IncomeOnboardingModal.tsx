import { useEffect, useState } from "react";
import { formatBRL, parseMoneyInput } from "../domain/money";

type Props = {
  open: boolean;
  /** Valor inicial para exibir no campo (ex.: perfil já salvo). */
  initialMonthlySalary: number;
  onConfirm: (monthlySalary: number) => void;
};

/** Primeiro acesso Firebase: confirma renda bruta mensal antes do tour pelos cartões. */
export function IncomeOnboardingModal({ open, initialMonthlySalary, onConfirm }: Props) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const s =
      initialMonthlySalary > 0
        ? String(initialMonthlySalary).replace(".", ",")
        : "";
    setRaw(s);
  }, [open, initialMonthlySalary]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = raw.trim();
    if (!trimmed) {
      setError("Informe sua renda bruta mensal para continuar.");
      return;
    }
    const n = parseMoneyInput(trimmed);
    if (n === null || n < 0) {
      setError("Valor inválido. Use apenas números, como em 5.000,00.");
      return;
    }
    setError(null);
    onConfirm(n);
  }

  const preview = parseMoneyInput(raw.trim());

  return (
    <div className="fixed inset-0 z-[192] flex items-center justify-center bg-[#001430]/55 p-4 backdrop-blur-[2px] dark:bg-black/60">
      <div
        className="income-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#002855] to-[#001430] p-8 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="income-onboarding-title"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-sky-400/15 blur-3xl" />

        <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-secondary">Primeiro passo</p>
        <h2 id="income-onboarding-title" className="relative mt-3 font-headline text-2xl font-extrabold text-white">
          Confirme sua renda bruta
        </h2>
        <p className="relative mt-2 text-sm leading-relaxed text-white/85">
          Informe o valor bruto mensal (salário e outras fontes recorrentes). Usamos para comparativos e metas — você pode
          alterar depois em Perfil.
        </p>

        <form className="relative mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="income-onboarding-value" className="mb-1 block text-xs font-semibold text-white/70">
              Renda bruta mensal (R$)
            </label>
            <input
              id="income-onboarding-value"
              autoFocus
              inputMode="decimal"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
              placeholder="Ex.: 5.000,00"
              className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base font-medium text-white outline-none placeholder:text-white/40 focus:border-secondary focus:ring-2 focus:ring-secondary/40"
            />
            {preview !== null && preview >= 0 ? (
              <p className="mt-2 text-xs text-white/65">
                Equivale a <span className="font-semibold text-white">{formatBRL(preview)}</span> por mês.
              </p>
            ) : null}
            {error ? <p className="mt-2 text-xs font-medium text-rose-300">{error}</p> : null}
          </div>
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-secondary font-headline text-base font-bold text-on-secondary shadow-lg transition hover:opacity-95 active:scale-[0.99]"
          >
            Confirmar e continuar
          </button>
        </form>

        <style>{`
          @keyframes income-pop-in {
            from {
              opacity: 0;
              transform: scale(0.94) translateY(12px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          .income-pop {
            animation: income-pop-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
        `}</style>
      </div>
    </div>
  );
}
