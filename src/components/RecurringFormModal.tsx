import { useEffect, useState } from "react";
import { formatBRL, parseMoneyInput } from "../domain/money";
import { recurringChargeForCreditCard } from "../domain/recurring";
import type { RecurringCadence, RecurringExpense } from "../domain/types";
import { useFinance } from "../context/FinanceContext";

const CATEGORIES = [
  "Moradia",
  "Entretenimento",
  "Serviços",
  "Compras",
  "Saúde",
  "Transporte",
  "Outros",
] as const;

const ICONS = ["home", "movie", "wifi", "shopping_bag", "bolt", "fitness_center", "pets"] as const;

type Props = {
  open: boolean;
  editingId: string | null;
  onClose: () => void;
};

export function RecurringFormModal({ open, editingId, onClose }: Props) {
  const { state, addRecurring, updateRecurring } = useFinance();
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [amountRaw, setAmountRaw] = useState("");
  const [dueDay, setDueDay] = useState(10);
  const [cadence, setCadence] = useState<RecurringCadence>("mensal");
  const [icon, setIcon] = useState<string>("home");
  const [payByCard, setPayByCard] = useState(false);
  const [creditCardId, setCreditCardId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingId) {
      const r = state.recurringExpenses.find((x) => x.id === editingId);
      if (r) {
        setName(r.name);
        setSubtitle(r.subtitle);
        setCategory(r.category);
        setAmountRaw(String(r.amount).replace(".", ","));
        setDueDay(r.dueDay);
        setCadence(r.cadence);
        setIcon(r.icon);
        const linked = r.creditCardId
          ? state.creditCards.find((c) => c.id === r.creditCardId)
          : null;
        const ccOk = linked?.kind === "credito" && r.creditCardId ? r.creditCardId : "";
        setPayByCard(!!ccOk);
        setCreditCardId(ccOk);
      }
    } else {
      setName("");
      setSubtitle("");
      setCategory(CATEGORIES[0]);
      setAmountRaw("");
      setDueDay(10);
      setCadence("mensal");
      setIcon("home");
      setPayByCard(false);
      setCreditCardId("");
    }
    // Só ao abrir/trocar edição — não incluir recurringExpenses: sync (HYDRATE) recriaria o array e apagaria o rascunho.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intencionais: open, editingId
  }, [open, editingId]);

  if (!open) return null;

  const creditoCards = state.creditCards.filter((c) => c.kind === "credito");

  const previewAmt = parseMoneyInput(amountRaw) ?? 0;
  const stubRecurring = {
    id: "_",
    name: "",
    subtitle: "",
    category: "",
    amount: previewAmt > 0 ? previewAmt : 0,
    dueDay: 1,
    cadence,
    icon: "home",
    paidMonths: [],
    creditCardId: null,
  } satisfies RecurringExpense;
  const chargeHint =
    previewAmt > 0 && payByCard
      ? recurringChargeForCreditCard(stubRecurring)
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseMoneyInput(amountRaw);
    if (!n || n <= 0) {
      setError("Valor inválido.");
      return;
    }
    if (!name.trim()) {
      setError("Informe o nome.");
      return;
    }
    if (dueDay < 1 || dueDay > 31) {
      setError("Dia de vencimento entre 1 e 31.");
      return;
    }
    if (payByCard && creditoCards.length === 0) {
      setError("Cadastre um cartão de crédito no painel para usar esta opção.");
      return;
    }
    if (payByCard && !creditCardId) {
      setError("Selecione o cartão.");
      return;
    }
    const ccFinal: string | null = payByCard && creditCardId ? creditCardId : null;
    if (editingId) {
      updateRecurring(editingId, {
        name: name.trim(),
        subtitle: subtitle.trim(),
        category,
        amount: n,
        dueDay,
        cadence,
        icon,
        creditCardId: ccFinal,
      });
    } else {
      addRecurring({
        name: name.trim(),
        subtitle: subtitle.trim(),
        category,
        amount: n,
        dueDay,
        cadence,
        icon,
        paidMonths: [],
        creditCardId: ccFinal,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-headline text-xl font-bold text-primary">
          {editingId ? "Editar despesa recorrente" : "Nova despesa recorrente"}
        </h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Detalhe</label>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor (R$)</label>
              <input
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Vencimento (dia)</label>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Recorrência</label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as RecurringCadence)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Ícone</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            >
              {ICONS.map((ic) => (
                <option key={ic} value={ic}>
                  {ic}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high/40 p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={payByCard}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPayByCard(on);
                  if (on && !creditCardId && creditoCards[0]) {
                    setCreditCardId(creditoCards[0].id);
                  }
                }}
                className="mt-1"
              />
              <span>
                <span className="block text-xs font-bold text-on-surface-variant">
                  Cobrança no cartão de crédito
                </span>
                <span className="text-xs text-on-surface-variant/80">
                  Ao marcar como pago no mês, o valor entra na fatura do cartão (mensal = valor cheio; anual =
                  1/12 por mês).
                </span>
              </span>
            </label>
            {payByCard && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">Cartão</label>
                {creditoCards.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Nenhum cartão de crédito cadastrado.</p>
                ) : (
                  <select
                    value={creditCardId}
                    onChange={(e) => setCreditCardId(e.target.value)}
                    className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {creditoCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ·••• {c.last4}
                      </option>
                    ))}
                  </select>
                )}
                {chargeHint != null && (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Reflexo na fatura ao pagar este mês:{" "}
                    <span className="font-bold text-primary">{formatBRL(chargeHint)}</span>
                  </p>
                )}
              </div>
            )}
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
