import { useEffect, useState } from "react";
import { defaultIconForAccent, LOYALTY_PRESET } from "../domain/loyaltyPoints";
import { parseMoneyInput } from "../domain/money";
import type { LoyaltyProgram, LoyaltyProgramAccent } from "../domain/types";
import { useFinance } from "../context/FinanceContext";

const ACCENTS: { value: LoyaltyProgramAccent; label: string }[] = [
  { value: "livelo", label: "Livelo" },
  { value: "esfera", label: "Esfera" },
  { value: "smiles", label: "Smiles" },
  { value: "latam", label: "LATAM Pass" },
  { value: "azul", label: "TudoAzul" },
  { value: "itau", label: "Pontos Itaú" },
  { value: "custom", label: "Outro" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  editing: LoyaltyProgram | null;
};

export function LoyaltyProgramModal({ open, onClose, editing }: Props) {
  const { addLoyaltyProgram, updateLoyaltyProgram } = useFinance();
  const [name, setName] = useState("");
  const [balanceRaw, setBalanceRaw] = useState("");
  const [accent, setAccent] = useState<LoyaltyProgramAccent>("livelo");
  const [icon, setIcon] = useState("circle");
  const [status, setStatus] = useState<"ativo" | "sincronizando">("ativo");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setBalanceRaw(String(editing.balance).replace(".", ","));
      setAccent(editing.accent);
      setIcon(editing.icon);
      setStatus(editing.status);
    } else {
      setName("");
      setBalanceRaw("");
      setAccent("livelo");
      setIcon(defaultIconForAccent("livelo"));
      setStatus("ativo");
    }
  }, [open, editing]);

  useEffect(() => {
    if (editing) return;
    setIcon(defaultIconForAccent(accent));
  }, [accent, editing]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const bal = parseMoneyInput(balanceRaw);
    if (bal === null || bal < 0) {
      setError("Saldo inválido.");
      return;
    }
    if (!name.trim()) {
      setError("Informe o nome do programa.");
      return;
    }
    if (editing) {
      updateLoyaltyProgram(editing.id, {
        name: name.trim(),
        balance: bal,
        accent,
        icon: icon.trim() || defaultIconForAccent(accent),
        status,
      });
    } else {
      addLoyaltyProgram({
        name: name.trim(),
        balance: bal,
        accent,
        icon: icon.trim() || defaultIconForAccent(accent),
        status,
      });
    }
    onClose();
  }

  const sample = LOYALTY_PRESET[accent];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-headline text-xl font-bold text-primary">
          {editing ? "Editar programa" : "Novo programa de pontos"}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Livelo"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Saldo (pts / milhas)</label>
              <input
                value={balanceRaw}
                onChange={(e) => setBalanceRaw(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "ativo" | "sincronizando")}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                <option value="ativo">Ativo</option>
                <option value="sincronizando">Sincronizando…</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Visual</label>
            <select
              value={accent}
              onChange={(e) => setAccent(e.target.value as LoyaltyProgramAccent)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            >
              {ACCENTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${sample.bg}`}>
                {sample.logoUrl ? (
                  <img
                    src={sample.logoUrl}
                    alt=""
                    className="h-full w-full object-contain p-1.5"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className={`material-symbols-outlined ${sample.text}`}>{icon}</span>
                )}
              </div>
              {!sample.logoUrl && (
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10px] font-bold text-on-surface-variant">
                    Ícone (Material Symbol)
                  </label>
                  <input
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full rounded border border-outline-variant/30 bg-white px-2 py-1 text-xs"
                    placeholder="flight"
                  />
                </div>
              )}
              {sample.logoUrl && (
                <p className="flex-1 text-xs text-on-surface-variant">Logo oficial do programa.</p>
              )}
            </div>
          </div>
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
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
