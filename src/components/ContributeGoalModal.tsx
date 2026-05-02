import { useState } from "react";
import { parseMoneyInput } from "../domain/money";
import { useFinance } from "../context/FinanceContext";

type Props = {
  open: boolean;
  goalId: string | null;
  onClose: () => void;
};

export function ContributeGoalModal({ open, goalId, onClose }: Props) {
  const { contributeGoal, state } = useFinance();
  const [amountRaw, setAmountRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const goal = goalId ? state.goals.find((g) => g.id === goalId) : null;

  if (!open || !goalId || !goal) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseMoneyInput(amountRaw);
    if (!n || n <= 0) {
      setError("Valor inválido.");
      return;
    }
    contributeGoal(goalId!, n);
    setAmountRaw("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-2 font-headline text-lg font-bold text-primary">Aportar em {goal.title}</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          O valor será debitado da conta corrente e creditado na meta.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor (R$)</label>
            <input
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-on-secondary hover:opacity-90"
            >
              Confirmar aporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
