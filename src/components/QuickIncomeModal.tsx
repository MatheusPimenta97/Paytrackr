import { useState } from "react";
import { parseMoneyInput } from "../domain/money";
import { useFinance } from "../context/FinanceContext";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
};

export function QuickIncomeModal({ open, title, onClose }: Props) {
  const { addTransaction, state } = useFinance();
  const [amountRaw, setAmountRaw] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseMoneyInput(amountRaw);
    if (!n || n <= 0) {
      setError("Valor inválido.");
      return;
    }
    addTransaction({
      date: new Date().toISOString().slice(0, 10),
      description: note.trim() || "Depósito",
      category: "Outros",
      amount: n,
      status: "recebido",
      icon: "payments",
      accountId: state.defaultAccountId,
    });
    setAmountRaw("");
    setNote("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-headline text-lg font-bold text-primary">{title}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor (R$)</label>
            <input
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Descrição (opcional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
