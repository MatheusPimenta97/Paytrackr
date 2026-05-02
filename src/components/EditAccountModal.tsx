import { useEffect, useState } from "react";
import { useFinance } from "../context/FinanceContext";
import type { Account } from "../domain/types";
import { parseMoneyInput } from "../domain/money";

const ICON_OPTIONS: { value: Account["icon"]; label: string }[] = [
  { value: "account_balance", label: "Conta / banco" },
  { value: "savings", label: "Economia / reserva" },
  { value: "show_chart", label: "Investimentos" },
];

type Props = {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
};

export function EditAccountModal({ open, accountId, onClose }: Props) {
  const { state, updateAccount } = useFinance();
  const [name, setName] = useState("");
  const [balanceRaw, setBalanceRaw] = useState("");
  const [icon, setIcon] = useState<Account["icon"]>("account_balance");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !accountId) return;
    const acc = state.accounts.find((a) => a.id === accountId);
    if (!acc) return;
    setName(acc.name);
    setBalanceRaw(String(acc.balance).replace(".", ","));
    setIcon(acc.icon);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir / trocar conta
  }, [open, accountId]);

  if (!open || !accountId) return null;

  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setError(null);
    const bal = parseMoneyInput(balanceRaw);
    if (bal === null) {
      setError("Saldo inválido.");
      return;
    }
    if (!name.trim()) {
      setError("Informe o nome da conta.");
      return;
    }
    updateAccount(accountId, { name: name.trim(), balance: bal, icon });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-headline text-lg font-bold text-primary">Editar conta</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Saldo (R$)</label>
            <input
              value={balanceRaw}
              onChange={(e) => setBalanceRaw(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Ícone</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value as Account["icon"])}
              className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
            >
              {ICON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold">
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
