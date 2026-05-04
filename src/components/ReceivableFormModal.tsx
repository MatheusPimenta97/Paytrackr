import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_INCOME_CATEGORIES,
  mergedIncomeCategorySelectOptions,
  normalizeCustomIncomeCategoriesForProfile,
} from "../domain/incomeCategories";
import { parseMoneyInput } from "../domain/money";
import { useFinance } from "../context/FinanceContext";

const ADD_CATEGORY_VALUE = "__paytrackr_add_income_category__";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ReceivableFormModal({ open, onClose }: Props) {
  const { addReceivable, state, updateProfile } = useFinance();
  const [debtorName, setDebtorName] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string>(DEFAULT_INCOME_CATEGORIES[0]);
  const [installmentMode, setInstallmentMode] = useState(false);
  const [installmentCountRaw, setInstallmentCountRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const incomeOptions = useMemo(() => {
    const merged = mergedIncomeCategorySelectOptions(state.profile.customIncomeCategories);
    const c = category.trim();
    if (c && !merged.includes(c)) return [...merged, c];
    return merged;
  }, [state.profile.customIncomeCategories, category]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDebtorName("");
    setAmountRaw("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setNote("");
    setCategory(DEFAULT_INCOME_CATEGORIES[0]);
    setInstallmentMode(false);
    setInstallmentCountRaw("");
  }, [open]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseMoneyInput(amountRaw);
    if (!n || n <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!debtorName.trim()) {
      setError("Informe uma descrição (origem da entrada).");
      return;
    }
    if (!dueDate) {
      setError("Informe o vencimento.");
      return;
    }
    let installmentCount: number | null = null;
    if (installmentMode && installmentCountRaw.trim()) {
      const k = parseInt(installmentCountRaw.replace(/\D/g, ""), 10);
      if (Number.isFinite(k) && k > 0) installmentCount = Math.min(999, k);
    }
    addReceivable({
      debtorName: debtorName.trim(),
      incomeCategory: category.trim(),
      amount: n,
      payments: [],
      installmentMode,
      installmentCount,
      dueDate,
      note: note.trim(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="recv-form-title"
      >
        <h2 id="recv-form-title" className="mb-1 font-headline text-xl font-bold text-primary">
          Nova receita
        </h2>
        <p className="mb-4 text-xs text-on-surface-variant">
          Entradas esperadas (salário, aluguel, dividendos ou valores de terceiros). Ao receber, o lançamento usa a
          categoria escolhida.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Categoria</label>
            <select
              value={category}
              onChange={(e) => {
                const v = e.target.value;
                if (v === ADD_CATEGORY_VALUE) {
                  const raw = window.prompt("Nome da nova categoria");
                  const name = raw?.trim().slice(0, 60);
                  if (!name) return;
                  const next = normalizeCustomIncomeCategoriesForProfile([
                    ...state.profile.customIncomeCategories,
                    name,
                  ]);
                  updateProfile({ customIncomeCategories: next });
                  setCategory(name);
                  return;
                }
                setCategory(v);
              }}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            >
              {incomeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value={ADD_CATEGORY_VALUE}>+ Adicionar categoria</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">
              Descrição / origem
            </label>
            <input
              value={debtorName}
              onChange={(e) => setDebtorName(e.target.value)}
              placeholder="Ex.: Salário CLT, Aluguel recebido, Dividendos ITUB4, João Silva…"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor (R$)</label>
              <input
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Vencimento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Observação (opcional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: serviço, NF…"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high/50 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={installmentMode}
                onChange={(e) => setInstallmentMode(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-bold text-primary">Parcelas no cartão</span>
                <span className="block text-xs text-on-surface-variant">
                  A pessoa vai te pagando aos poucos (cada entrada você registra abaixo).
                </span>
              </span>
            </label>
            {installmentMode && (
              <div className="mt-3 pl-6">
                <label className="mb-1 block text-[10px] font-bold uppercase text-on-surface-variant">
                  Nº de parcelas (opcional)
                </label>
                <input
                  value={installmentCountRaw}
                  onChange={(e) => setInstallmentCountRaw(e.target.value)}
                  placeholder="Ex.: 12"
                  inputMode="numeric"
                  className="w-full max-w-[120px] rounded-lg bg-surface-container-high px-3 py-2 text-sm"
                />
              </div>
            )}
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
