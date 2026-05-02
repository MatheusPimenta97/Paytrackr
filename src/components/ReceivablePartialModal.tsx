import { useEffect, useState } from "react";
import { formatBRL, parseMoneyInput } from "../domain/money";
import { receivableRemaining } from "../domain/receivables";
import type { Receivable } from "../domain/types";

type Props = {
  open: boolean;
  receivable: Receivable | null;
  onClose: () => void;
  onConfirm: (opts: { amount: number; registerIncome: boolean }) => void;
};

export function ReceivablePartialModal({ open, receivable, onClose, onConfirm }: Props) {
  const [raw, setRaw] = useState("");
  const [registerIncome, setRegisterIncome] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const remaining = receivable ? receivableRemaining(receivable) : 0;

  useEffect(() => {
    if (!open || !receivable) return;
    setError(null);
    setRaw("");
    setRegisterIncome(true);
  }, [open, receivable]);

  if (!open || !receivable) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseMoneyInput(raw);
    if (n === null || n <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (n > remaining + 0.001) {
      setError(`O máximo agora é ${formatBRL(remaining)}.`);
      return;
    }
    onConfirm({ amount: n, registerIncome });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="partial-recv-title"
      >
        <h2 id="partial-recv-title" className="mb-1 font-headline text-xl font-bold text-primary">
          Registrar parcela / valor parcial
        </h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          Falta <span className="font-bold text-primary">{formatBRL(remaining)}</span> de{" "}
          <span className="font-semibold">{formatBRL(receivable.amount)}</span> ({receivable.debtorName}).
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor recebido agora (R$)</label>
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              autoFocus
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={registerIncome}
              onChange={(e) => setRegisterIncome(e.target.checked)}
            />
            Lançar na conta principal como receita
          </label>
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
