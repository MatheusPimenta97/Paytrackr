import { useEffect, useState } from "react";
import type { Transaction } from "../domain/types";

type Props = {
  open: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSave: (thirdPartyName: string | null) => void;
};

export function CreditCardThirdPartyModal({ open, transaction, onClose, onSave }: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open || !transaction) return;
    setName(transaction.thirdPartyName ?? "");
  }, [open, transaction]);

  if (!open || !transaction) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = name.trim();
    onSave(t.length > 0 ? t.slice(0, 120) : null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="tp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="tp-title" className="mb-1 font-headline text-lg font-bold text-primary">
          Quem usou o cartão?
        </h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          Vincule esta compra a outra pessoa (cartão emprestado, divisão etc.).{" "}
          <span className="font-medium text-primary">{transaction.description}</span>
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Nome ou apelido</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: João, colega de trabalho…"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
